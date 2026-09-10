import Dialog from "./Dialog";
import {
  ArrowDown,
  ArrowRight,
  Cpu,
  Database,
  Monitor,
  ShieldCheck,
} from "lucide-react";

export default function Architecture({
  lang,
  close,
}: {
  lang: "en" | "es";
  close: () => void;
}) {
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  return (
    <Dialog
      title={b("How Aerovia works", "Cómo funciona Aerovia")}
      close={close}
    >
      <p>
        {b(
          "A local engineering workbench with two independently checked calculation paths.",
          "Un espacio de ingeniería local con dos vías de cálculo verificadas independientemente.",
        )}
      </p>
      <div className="architecture-map">
        <section>
          <div className="architecture-label">
            <Monitor size={18} />
            {b("IN YOUR BROWSER", "EN SU NAVEGADOR")}
          </div>
          <div className="architecture-node">
            <strong>{b("Network + settings", "Red + configuración")}</strong>
            <span>
              {b(
                "Verified case or local JSON project",
                "Caso verificado o proyecto JSON local",
              )}
            </span>
          </div>
          <ArrowDown className="architecture-arrow" />
          <div className="architecture-node">
            <strong>
              {b("Validated numerical worker", "Cálculo numérico validado")}
            </strong>
            <span>
              {b(
                "Flow balance · fan curves · sensitivity · speed search",
                "Balance de caudal · curvas · sensibilidad · velocidad",
              )}
            </span>
          </div>
          <ArrowDown className="architecture-arrow" />
          <div className="architecture-node">
            <strong>{b("Interactive workbench", "Espacio interactivo")}</strong>
            <span>
              {b(
                "3D · charts · results table · project and CSV exports",
                "3D · gráficos · tabla · exportación JSON y CSV",
              )}
            </span>
          </div>
        </section>
        <section>
          <div className="architecture-label">
            <Cpu size={18} />
            {b("LOCAL OFFLINE PROCESSING", "PROCESAMIENTO LOCAL")}
          </div>
          <div className="architecture-node">
            <strong>
              {b("Create / download / import", "Crear / descargar / importar")}
            </strong>
            <span>
              {b(
                "Versioned network contract + source checksums",
                "Contrato de red versionado + sumas de origen",
              )}
            </span>
          </div>
          <ArrowDown className="architecture-arrow" />
          <div className="architecture-node">
            <strong>
              {b(
                "SciPy reference + PyTorch CUDA",
                "Referencia SciPy + PyTorch CUDA",
              )}
            </strong>
            <span>
              {b(
                "Independent solutions · resistance ensembles · residuals",
                "Soluciones independientes · conjuntos de resistencia · residuos",
              )}
            </span>
          </div>
          <ArrowDown className="architecture-arrow" />
          <div className="architecture-node">
            <strong>
              {b("Verified data artifacts", "Artefactos verificados")}
            </strong>
            <span>
              {b(
                "Inputs · percentiles · parity checks · hash manifest",
                "Entradas · percentiles · comparaciones · manifiesto",
              )}
            </span>
          </div>
        </section>
      </div>
      <div className="architecture-boundary">
        <Database size={20} />
        <p>
          {b(
            "GitHub Pages serves the app and the committed public case library. CI validates existing artifacts before publishing. It does not generate scientific results during deployment.",
            "GitHub Pages sirve la aplicación y la biblioteca pública. CI valida los artefactos existentes antes de publicar; no genera resultados científicos durante el despliegue.",
          )}
        </p>
      </div>
      <div className="architecture-boundary">
        <ShieldCheck size={20} />
        <p>
          {b(
            "Imported projects and live calculations stay in this browser. There is no application server, login, telemetry or secret API key. The offline scripts run only when you invoke them. Public ensemble results apply only to their original inputs.",
            "Los proyectos importados y cálculos permanecen en este navegador. No hay servidor de aplicación, cuenta, telemetría ni clave API. Los scripts locales se ejecutan cuando usted los invoca. Los conjuntos públicos corresponden solo a sus entradas originales.",
          )}
        </p>
      </div>
      <a
        className="architecture-link"
        href="https://github.com/fsantibanezleal/CAOS_Aerovia/blob/main/docs/architecture.md"
        target="_blank"
        rel="noreferrer"
      >
        {b(
          "Architecture, contracts and reproduction guides",
          "Arquitectura, contratos y guías de reproducción",
        )}{" "}
        <ArrowRight size={15} />
      </a>
    </Dialog>
  );
}
