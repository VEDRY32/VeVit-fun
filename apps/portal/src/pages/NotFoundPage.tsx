import type { I18n } from '../lib/i18n.js';

export function NotFoundPage({ i18n }: { i18n: I18n }): JSX.Element {
  return (
    <div className="stav">
      <h1>{i18n.t('error.notFound')}</h1>
      <p>
        {i18n.locale === 'cs'
          ? 'Možná se přejmenovala, nebo tu ještě není.'
          : 'It may have been renamed, or it is not here yet.'}
      </p>
      <a className="tlacitko tlacitko--hlavni" href={`/${i18n.locale}/`}>
        {i18n.t('error.backHome')}
      </a>
    </div>
  );
}
