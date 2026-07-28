import type { CharacterSelectionProjection } from "./login-flow";

export type LoginCredentials = {
  identifier: string;
  password: string;
};

export type LoginGatewayResult =
  | { ok: true; selection: CharacterSelectionProjection }
  | { ok: false; message: string };

export type LoginGateway = {
  login(credentials: LoginCredentials, signal: AbortSignal): Promise<LoginGatewayResult>;
};

const UNAVAILABLE_MESSAGE = "Login is not available yet. Your credentials were not accepted or stored.";

export function createUnavailableLoginGateway(): LoginGateway {
  return {
    async login(_credentials, signal) {
      if (signal.aborted) throw new DOMException("The login request was cancelled.", "AbortError");
      return { ok: false, message: UNAVAILABLE_MESSAGE };
    },
  };
}
