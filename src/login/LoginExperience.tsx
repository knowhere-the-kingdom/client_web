import { useEffect, useReducer, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";

import { createUnavailableLoginGateway, type LoginGateway } from "./login-gateway";
import { initialLoginFlowState, reduceLoginFlow } from "./login-flow";

const KEY_DRAG_TYPE = "application/x-knowhere-designer-key";

type LoginExperienceProps = {
  gateway?: LoginGateway;
};

export function LoginExperience({ gateway = createUnavailableLoginGateway() }: LoginExperienceProps) {
  const [flow, dispatch] = useReducer(reduceLoginFlow, initialLoginFlowState);
  const [dropActive, setDropActive] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const placeKey = () => dispatch({ type: "key_placed" });

  const startDrag = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(KEY_DRAG_TYPE, "designer-key");
  };

  const acceptDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(false);
    if (event.dataTransfer.getData(KEY_DRAG_TYPE) === "designer-key") placeKey();
  };

  const handleSlotKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      placeKey();
    }
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (flow.stage !== "login_ready") return;

    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier") ?? "");
    const password = String(form.get("password") ?? "");
    if (!identifier || !password) {
      dispatch({ type: "login_submitted" });
      dispatch({ type: "login_failed", message: "Enter your account name and password." });
      return;
    }

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    dispatch({ type: "login_submitted" });

    try {
      const result = await gateway.login({ identifier, password }, controller.signal);
      if (controller.signal.aborted) return;
      if (result.ok) dispatch({ type: "login_succeeded", selection: result.selection });
      else dispatch({ type: "login_failed", message: result.message });
    } catch {
      if (!controller.signal.aborted) {
        dispatch({ type: "login_failed", message: "Login is unavailable. Please try again later." });
      }
    }
  };

  if (flow.stage === "key_ready") {
    return (
      <section className="login-experience login-experience--key" aria-labelledby="key-title">
        <div className="login-experience__key-area">
          <p className="browser-shell__eyebrow">Knowhere</p>
          <h1 id="key-title">Bring the key to the designer</h1>
          <button
            className="designer-key"
            type="button"
            draggable
            onDragStart={startDrag}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                placeKey();
              }
            }}
            aria-label="Designer key. Drag it into the designer slot, or activate it with the keyboard."
          >
            <span className="designer-key__head" aria-hidden="true" />
            <span className="designer-key__shaft" aria-hidden="true" />
            <span className="designer-key__teeth" aria-hidden="true" />
          </button>
          <div
            className={`designer-slot${dropActive ? " designer-slot--active" : ""}`}
            role="button"
            tabIndex={0}
            onDragEnter={() => setDropActive(true)}
            onDragLeave={() => setDropActive(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={acceptDrop}
            onKeyDown={handleSlotKey}
            aria-label="Designer slot. Drop or place the key here to open login."
          >
            <span className="designer-slot__mark" aria-hidden="true" />
            <span>Designer slot</span>
          </div>
          <p className="login-experience__hint">Drag the key into the slot.</p>
        </div>
      </section>
    );
  }

  if (flow.stage === "character_selection") {
    return (
      <section className="login-experience" aria-labelledby="character-title">
        <div className="login-card">
          <p className="browser-shell__eyebrow">Knowhere</p>
          <h1 id="character-title">Choose your character</h1>
          <p className="login-card__intro">Select who will enter Knowhere.</p>
          <div className="character-list" role="list">
            {flow.selection.characters.length > 0 ? flow.selection.characters.map((character) => (
              <button
                key={character.id}
                className="character-list__item"
                type="button"
                role="listitem"
                disabled={!character.selectable}
              >
                <strong>{character.displayName}</strong>
                <span>{character.archetype}</span>
              </button>
            )) : (
              <p className="login-card__notice">No selectable characters are available.</p>
            )}
          </div>
          <p className="login-card__notice">Character confirmation remains unavailable until the Gateway selection handler is connected.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="login-experience" aria-labelledby="login-title">
      <form className="login-card" onSubmit={submitLogin}>
        <p className="browser-shell__eyebrow">Knowhere</p>
        <h1 id="login-title">Enter Knowhere</h1>
        <p className="login-card__intro">Use your account name or email to continue.</p>
        <label>
          Account
          <input name="identifier" autoComplete="username" disabled={flow.stage === "submitting"} />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" disabled={flow.stage === "submitting"} />
        </label>
        <button className="login-card__submit" type="submit" disabled={flow.stage === "submitting"}>
          {flow.stage === "submitting" ? "Checking…" : "Continue"}
        </button>
        {flow.stage === "login_ready" && flow.error ? (
          <p className="login-card__error" role="alert">{flow.error}</p>
        ) : null}
        <p className="login-card__notice">Login remains fail-closed until the public Gateway auth handler is available.</p>
      </form>
    </section>
  );
}
