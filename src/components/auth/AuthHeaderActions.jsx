import LanguageToggle from '../ui/LanguageToggle.jsx';
import DemoVideoWatchButton from '../demo/DemoVideoWatchButton.jsx';

/**
 * Global auth bar: language + Watch Demo (login/register).
 */
const AuthHeaderActions = () => (
  <div className="tp-auth-v2__actions d-flex align-items-center gap-2 flex-wrap justify-content-end">
    <LanguageToggle className="tp-auth-v2__header-btn" />
    <DemoVideoWatchButton variant="authHeader" />
  </div>
);
export default AuthHeaderActions;
