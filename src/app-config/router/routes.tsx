import { lazy } from "react";

const Invite = lazy(() => import("../../pages/Invite"));
const Lobby = lazy(() => import("../../pages/Lobby"));
const PerformRoom = lazy(() => import("../../pages/PerformRoom"));
const ArrangeRoom = lazy(() => import("../../pages/ArrangeRoom"));
const AudienceRoom = lazy(() => import("../../pages/AudienceRoom"));
const Login = lazy(() => import("../../pages/Login"));
const Register = lazy(() => import("../../pages/Register"));
const VerifyEmail = lazy(() => import("../../pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("../../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../../pages/ResetPassword"));
const AccountSettings = lazy(() => import("../../pages/AccountSettings"));
const AuthCallback = lazy(() => import("../../pages/AuthCallback"));

export const routes = [
  { path: "/", component: Lobby },
  { path: "/perform/:roomId", component: PerformRoom },
  { path: "/perform/:roomId/audience", component: AudienceRoom },
  { path: "/arrange/:roomId", component: ArrangeRoom },
  { path: "/invite/:roomId", component: Invite },
  // Legacy redirect support
  { path: "/room/:roomId", component: PerformRoom },
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
  component: React.ComponentType<any>;
};
