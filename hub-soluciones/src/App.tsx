import { useState } from "react";
import { MotionConfig } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Header, Hero, Capabilities, Logo } from "./components/Landing";
import { Demos } from "./components/Demos";
import { Packages, Contact, type Inquiry } from "./components/Packages";
import { DemoModal } from "./components/DemoModal";
import { projects, type Project } from "./data/projects";
export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [inquiry, setInquiry] = useState<Inquiry>({ plan: "", demo: "" });
  return (
    <MotionConfig reducedMotion="user">
      <Header />
      <main>
        <Hero onDemo={() => setProject(projects[0])} />
        <div className="expertise">
          <div className="container">
            <span>BUENAS IDEAS. MEJOR EJECUCIÓN.</span>
            <span>Automatización</span>
            <i>✳</i>
            <span>Software a medida</span>
            <i>✳</i>
            <span>Inteligencia artificial</span>
            <i>✳</i>
            <span>Marketing conectado</span>
          </div>
        </div>
        <Demos onOpen={setProject} />
        <Capabilities />
        <Packages inquiry={inquiry} setInquiry={setInquiry} />
        <Contact inquiry={inquiry} setInquiry={setInquiry} />
      </main>
      <footer className="footer container">
        <Logo />
        <span>Hecho para encender el siguiente paso.</span>
        <a href="#inicio">
          Volver arriba <ArrowUpRight size={15} />
        </a>
      </footer>
      {project && (
        <DemoModal
          key={project.id}
          project={project}
          onClose={() => setProject(null)}
          onQuote={(p) => {
            setInquiry((v) => ({ ...v, demo: p.name }));
            setProject(null);
            window.setTimeout(() => {
              window.location.hash = "paquetes";
              document
                .getElementById("paquetes")
                ?.scrollIntoView({ behavior: "smooth" });
            }, 0);
          }}
        />
      )}
    </MotionConfig>
  );
}
