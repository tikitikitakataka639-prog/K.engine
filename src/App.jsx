import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { EngineArchitecture } from "./components/EngineArchitecture";
import { ModelSelector } from "./components/ModelSelector";
import { ModelLab } from "./components/ModelLab";
import { Hardware } from "./components/Hardware";
import { ControlPanel } from "./components/ControlPanel";
import { ApiSection } from "./components/ApiSection";
import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="bg-ink-950 text-slate-200 antialiased min-h-screen">
      <Nav />
      <Hero />
      <EngineArchitecture />
      <ModelSelector />
      <ModelLab />
      <Hardware />
      <ControlPanel />
      <ApiSection />
      <Faq />
      <Footer />
    </div>
  );
}
