import Invite from "../../pages/Invite";
import Lobby from "../../pages/Lobby";
import PerformRoom from "../../pages/PerformRoom";

export const routes = [
  { path: "/", component: Lobby },
  { path: "/perform/:roomId", component: PerformRoom },
  { path: "/invite/:roomId", component: Invite },
  { path: "/room/:roomId", component: PerformRoom }, // Legacy redirect support
  { path: "*", component: Lobby }, // Fallback route
];

export type AppRoute = {
  path: string;
  component: React.ComponentType;
};
