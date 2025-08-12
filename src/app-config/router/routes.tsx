import Invite from "../../pages/Invite";
import Lobby from "../../pages/Lobby";
import Room from "../../pages/Room";

export const routes = [
  { path: "/", component: Lobby },
  { path: "/room/:roomId", component: Room },
  { path: "/invite/:roomId", component: Invite },
  { path: "*", component: Lobby }, // Fallback route
];

export type AppRoute = {
  path: string;
  component: React.ComponentType;
};
