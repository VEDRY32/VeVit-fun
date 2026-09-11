# RUNBOOK — VeVit Games

Provozní příručka pro VPS. Vše, co člověk potřebuje ve 3 ráno.

## 1. Topologie

```
Internet ──► Caddy (443, TLS, HTTP/3)
              ├─ vevit.fun         → statický build portálu (volume web_dist)
              ├─ vevit.fun/api/*   → api:3001 (Fastify)
              └─ rt.vevit.fun/ws   → realtime:3002 (ws)
Interní síť (bez přístupu ven): api, realtime, worker, redis
```

Kontejnery kromě `caddy` **nepublikují žádný port** na host.

## 2. První nasazení serveru

```bash
# 1) neroot deploy uživatel
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# vlož veřejný klíč do /home/deploy/.ssh/authorized_keys

# 2) SSH jen klíčem
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh

# 3) firewall
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable

# 4) fail2ban + automatické bezpečnostní aktualizace
apt-get install -y fail2ban unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
systemctl enable --now fail2ban

# 5) Docker
curl -fsSL https://get.docker.com | sh
```

## 3. Konfigurace

Tajemství žijí **jen** v `/srv/vevit-games/.env` na serveru (`chmod 600`,
vlastník `deploy`). V repu je pouze `.env.example`. Nikdy necommitovat `.env`.

```bash
su - deploy
git clone https://github.com/VEDRY32/VeVit-fun.git /srv/vevit-games
cd /srv/vevit-games && cp .env.example .env && chmod 600 .env && ${EDITOR:-vi} .env
```

## 4. Deploy

GitHub Actions sestaví image, otaguje je SHA commitu a pushne do registru.
Deploy krok se pak přes SSH připojí a spustí:

```bash
cd /srv/vevit-games/ops
export TAG=<git-sha>
echo "$TAG" > .last-good-candidate
docker compose pull
docker compose up -d --remove-orphans
docker compose run --rm web            # rozbalí nový statický build do volume
./scripts/smoke.sh || ./scripts/rollback.sh
mv .last-good-candidate .last-good
```

### Rollback

```bash
cd /srv/vevit-games/ops
export TAG=$(cat .last-good)
docker compose pull && docker compose up -d
```

Rollback je vždy na **předchozí tag**, nikdy na `latest`. Migrace DB se píší
dopředně kompatibilní (nová sloupec = nullable, mazání až o release později),
aby rollback aplikace nevyžadoval rollback schématu.

## 5. Health a monitoring

| Endpoint | Očekáváno |
|---|---|
| `https://vevit.fun/healthz` | `ok` (Caddy) |
| `https://vevit.fun/api/healthz` | `{"status":"ok","db":"ok","redis":"ok"}` |
| `https://rt.vevit.fun/healthz` | `{"status":"ok","rooms":N,"players":N}` |

Externí kontrola: Uptime Kuma (vlastní hosting) nebo healthchecks.io pro cron
workeru. Alert při 2 selháních po sobě.

## 6. Logy

`json-file` driver, rotace 10 MB × 5 souborů na službu (v compose).

```bash
docker compose logs -f --tail=200 api
docker compose logs --since 1h realtime | grep -i error
```

## 7. Zálohy

Worker spouští denně ve 03:15 Europe/Prague:

```bash
pg_dump --format=custom --schema=games "$DATABASE_URL" > games-$(date +%F).dump
```

- Retence: 7 denních, 4 týdenní, 6 měsíčních.
- Cíl: offsite S3-kompatibilní úložiště, šifrováno (`age` nebo SSE).
- **Obnovu testovat čtvrtletně** — záloha bez zkoušené obnovy není záloha:
  `pg_restore --clean --if-exists --schema=games -d "$STAGING_URL" games-YYYY-MM-DD.dump`

## 8. Incidenty

| Příznak | První kroky |
|---|---|
| 502 na `/api/*` | `docker compose ps api`, `logs api`, health `db`/`redis`; restart `api` |
| WS se nepřipojí | ověř `Origin` v logu realtime, platnost ticketu (60 s), čas na serveru (`timedatectl`) |
| Vysoké CPU u realtime | `docker stats`, počet místností přes `/healthz`; nad 60 % CPU zastav matchmaking do nových místností |
| Disk plný | `docker system prune -af --volumes=false`, zkontroluj rotaci logů a staré image |
| Podezřelé skóre | admin → flagged; `POST /api/admin/runs/:id/reject` |
| Únik tajemství | rotuj `SESSION_SECRET`, `RT_TICKET_SECRET`, `ORIGIN_KEY`, service role key; restart všech služeb (invaliduje všechny session) |

## 9. Pravidelná údržba

- **Týdně** — projít flagged skóre a reporty, zkontrolovat velikost Redis.
- **Měsíčně** — `docker compose pull` bázových image (caddy, redis), restart.
- **Čtvrtletně** — test obnovy zálohy, revize závislostí (`pnpm audit`), rotace klíčů.
