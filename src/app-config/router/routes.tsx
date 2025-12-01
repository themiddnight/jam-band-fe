import Invite from "../../pages/Invite";
import Lobby from "../../pages/Lobby";
import PerformRoom from "../../pages/PerformRoom";
import ArrangeRoom from "../../pages/ArrangeRoom";
import AudienceRoom from "../../pages/AudienceRoom";
import Login from "../../pages/Login";
import Register from "../../pages/Register";
import VerifyEmail from "../../pages/VerifyEmail";
import ForgotPassword from "../../pages/ForgotPassword";
import ResetPassword from "../../pages/ResetPassword";
import AccountSettings from "../../pages/AccountSettings";
import AuthCallback from "../../pages/AuthCallback";

export const routes = [
  { path: "/", component: Lobby },
  { path: "/perform/:roomId", component: PerformRoom },
  { path: "/perform/:roomId/audience", component: AudienceRoom },
  { path: "/arrange/:roomId", component: ArrangeRoom },
  { path: "/invite/:roomId", component: Invite },
  { path: "/room/:roomId", component: PerformRoom }, // Legacy redirect support
  // Auth routes
  { path: "/login", component: Login },
  { path: "/register", component: Register },
  { path: "/verify-email", component: VerifyEmail },
  { path: "/forgot-password", component: ForgotPassword },
  { path: "/reset-password", component: ResetPassword },
  { path: "/account", component: AccountSettings },
  { path: "/auth/callback", component: AuthCallback },
  { path: "*", component: Lobby }, // Fallback route
];

export type AppRoute = {
  path: string;
  component: React.ComponentType;
};
