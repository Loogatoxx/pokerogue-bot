import { NOMBRE_ACTIONS, PREMIERE_BALL } from "../../observateur/actions";

export const estBall = (action: number) => action >= PREMIERE_BALL && action < NOMBRE_ACTIONS;

export const masqueSansBalls = (masque: boolean[], bloquer: boolean) => masque.map((permise, i) => permise && !(bloquer && estBall(i)));
