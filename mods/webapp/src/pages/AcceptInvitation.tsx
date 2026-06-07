import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";

export function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const workspace = params.get("workspace") ?? "este espacio";
  const inviter = params.get("inviter");
  const role = params.get("role") ?? "Miembro";

  const subtitle = inviter
    ? `${inviter} te invitó a unirte como ${role}.`
    : `Fuiste invitado a unirte como ${role}.`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 p-8 shadow-none">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-[22px] font-bold text-slate-900">Te invitaron a {workspace}</h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <Button size="lg" className="w-full" onClick={() => navigate("/signup")}>
              Aceptar invitación
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-slate-500"
              onClick={() => navigate("/")}
            >
              Rechazar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
