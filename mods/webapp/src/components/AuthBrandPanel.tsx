import { Logo } from "./Logo.js";

export function AuthBrandPanel() {
  return (
    <div
      className="flex w-[540px] shrink-0 flex-col justify-between p-[52px]"
      style={{ background: "linear-gradient(145deg, #022C22 0%, #059669 100%)" }}
    >
      <Logo variant="white" />
      <div className="flex flex-col gap-5">
        <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-300">
          Cobranza Inteligente
        </p>
        <h2
          className="text-[38px] font-extrabold text-white"
          style={{ lineHeight: 1.1, letterSpacing: "-0.5px" }}
        >
          Gestiona tu cartera
          <br />
          en un solo lugar.
        </h2>
        <p className="text-[15px] leading-relaxed text-emerald-200">
          Deudores, campañas, agentes IA y resultados — gestionados desde un panel directo y
          operativo.
        </p>
      </div>
      <p className="text-[12px] font-medium text-white/30">© 2026 QCobro · Fonoster Inc.</p>
    </div>
  );
}
