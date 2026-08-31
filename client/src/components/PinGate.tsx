import { useEffect, useRef, useState } from "react";

type PinGateProps = {
  loading: boolean;
  error: string | null;
  onSubmit: (pin: string) => Promise<void>;
};

export default function PinGate({ loading, error, onSubmit }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pin.length !== 4) {
      setFormError("Enter the 4-digit PIN to continue.");
      inputRef.current?.focus();
      return;
    }
    setFormError(null);
    try {
      await onSubmit(pin);
    } catch {
      setPin("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const visibleError = formError || error;

  return (
    <main className="pin-gate min-h-[100dvh] overflow-hidden px-4 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <div className="pin-gate-noise" aria-hidden="true" />
      <div className="pin-gate-orbit pin-gate-orbit-one" aria-hidden="true" />
      <div className="pin-gate-orbit pin-gate-orbit-two" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl items-center justify-center sm:min-h-[calc(100dvh-5rem)]">
        <section className="pin-gate-shell grid w-full overflow-hidden rounded-[2rem] bg-white/70 p-1.5 shadow-[0_24px_80px_rgba(40,54,30,0.12)] ring-1 ring-neutral-950/5 backdrop-blur-xl md:grid-cols-[0.92fr_1.08fr]">
          <div className="pin-gate-story relative flex min-h-[17rem] flex-col justify-between overflow-hidden rounded-[1.6rem] bg-neutral-950 p-7 text-white sm:p-10 md:min-h-[34rem]">
            <div className="pin-gate-story-glow" aria-hidden="true" />
            <div className="relative z-10 flex items-center gap-3">
              <span className="pin-gate-mark" aria-hidden="true"><span /></span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">Personal Life Dashboard</span>
            </div>
            <div className="relative z-10 mt-12 max-w-sm md:mt-0">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-300">A quieter way to move forward</p>
              <h1 className="max-w-[12ch] text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl">Make room for what matters.</h1>
              <p className="mt-5 max-w-xs text-sm leading-6 text-white/60">Your plans, reflections, and next steps stay in one private space.</p>
            </div>
            <p className="relative z-10 mt-10 text-xs text-white/35">Private workspace · Standalone access</p>
          </div>

          <div className="flex items-center justify-center rounded-[1.6rem] bg-[#fbfcf8] px-6 py-10 sm:px-12 md:min-h-[34rem]">
            <div className="w-full max-w-sm">
              <div className="mb-9">
                <span className="mb-4 inline-flex rounded-full bg-lime-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-800">Welcome back</span>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-neutral-950 sm:text-4xl">Unlock your dashboard.</h2>
                <p className="mt-3 max-w-xs text-sm leading-6 text-neutral-500">Enter your 4-digit access PIN to continue to your personal operating system.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="dashboard-pin" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Access PIN</label>
                <input
                  ref={inputRef}
                  id="dashboard-pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setFormError(null);
                  }}
                  aria-invalid={Boolean(visibleError)}
                  aria-describedby={visibleError ? "dashboard-pin-error" : "dashboard-pin-help"}
                  className="pin-gate-input w-full rounded-[1.15rem] bg-white px-5 py-4 text-center text-3xl font-semibold tracking-[0.55em] text-neutral-950 outline-none ring-1 ring-neutral-950/10 transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] placeholder:text-neutral-300 focus:-translate-y-0.5 focus:ring-2 focus:ring-lime-500/70"
                  placeholder="••••"
                  aria-label="4-digit dashboard PIN"
                />
                {visibleError ? <p id="dashboard-pin-error" role="alert" aria-live="polite" className="mt-3 text-sm leading-5 text-rose-700">{visibleError}</p> : <p id="dashboard-pin-help" className="mt-3 text-xs leading-5 text-neutral-400">Your access stays active on this device until you log out or the session expires.</p>}
                <button type="submit" disabled={loading} className="pin-gate-submit group mt-6 flex min-h-12 w-full items-center justify-between rounded-full bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70">
                  <span>{loading ? "Unlocking…" : "Unlock dashboard"}</span>
                  <span className="pin-gate-arrow flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">{loading ? "·" : "↗"}</span>
                </button>
              </form>

              <p className="mt-8 text-center text-[11px] leading-5 text-neutral-400">Keep this code private. It protects the entire dashboard and its saved data.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
