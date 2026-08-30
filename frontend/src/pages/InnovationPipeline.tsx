import React from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { Sparkles, FlaskConical, Rocket, Cpu, Check } from "../components/icons"

const stages = [
  {
    name: "Idea",
    icon: Sparkles,
    tone: "bg-blue-50 text-blue-600 border-blue-200",
    description:
      "Every innovation starts as an idea — a problem worth solving, a question worth asking, an opportunity worth exploring.",
    activities: ["Problem framing", "Ideation", "Opportunity screening"],
  },
  {
    name: "Validation",
    icon: FlaskConical,
    tone: "bg-blue-50 text-blue-600 border-blue-200",
    description:
      "We test assumptions before investing. Is the problem real? Does the approach hold up? What do the numbers say?",
    activities: ["Market & technical research", "Assumption testing", "Feasibility review"],
  },
  {
    name: "Prototype",
    icon: Cpu,
    tone: "bg-purple-50 text-purple-700 border-purple-200",
    description:
      "A working prototype de-risks the build. It turns assumptions into something we can touch, test and learn from.",
    activities: ["Rapid prototyping", "Proof-of-concept", "Early user testing"],
  },
  {
    name: "Development",
    icon: Rocket,
    tone: "bg-slate-100 text-slate-800 border-slate-300",
    description:
      "From validated prototype to disciplined engineering — architecture, development, testing and refinement.",
    activities: ["Architecture", "Iterative development", "Testing & QA"],
  },
  {
    name: "Release",
    icon: Check,
    tone: "bg-green-50 text-green-700 border-green-200",
    description:
      "A shippable product, handed over to real users and maintained through its lifecycle.",
    activities: ["Deployment", "Launch", "Maintenance"],
  },
]

const InnovationPipeline: React.FC = () => {
  usePageMeta({
    title: "Innovation Pipeline",
    description:
      "How Skynova Project Labs takes an idea from conception through validation, prototype, development and release.",
    canonical: "/innovation-pipeline",
  })

  return (
    <main id="main">
      <section className="hero-section">
        <div className="hero-inner">
          <span className="hero-eyebrow">Innovation Pipeline</span>
          <h1 className="hero-title">From idea to release, every time.</h1>
          <p className="hero-subtitle">
            A disciplined path that moves innovation forward — and catches problems early.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-16" aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className="sr-only">Pipeline stages</h2>

        {/* Desktop: horizontal stepper */}
        <div className="hidden md:block mb-12" aria-hidden="true">
          <div className="flex items-center">
            {stages.map((stage, i) => (
              <div key={stage.name} className="flex items-center flex-1">
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${stage.tone}`}>
                    <stage.icon className="w-7 h-7" />
                  </div>
                  <span className="mt-2 text-sm font-semibold text-gray-900">{stage.name}</span>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex-1 mx-3 h-0.5 bg-blue-200 relative self-start mt-7">
                    <span className="absolute -top-1.5 right-0 text-blue-400">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stage cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage, i) => (
            <article key={stage.name} className="card p-6 flex flex-col">
              <div className={`w-11 h-11 rounded-md border flex items-center justify-center mb-3 ${stage.tone}`}>
                <stage.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Stage {i + 1}</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{stage.name}</h3>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">{stage.description}</p>
              <ul className="mt-4 space-y-1.5">
                {stage.activities.map((activity) => (
                  <li key={activity} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                    {activity}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          <ArticleMutations />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="card bg-slate-900 text-white p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Have an idea worth moving forward?</h2>
          <p className="text-gray-300 mb-6 max-w-xl mx-auto">
            Bring it to us and we'll put it through the pipeline.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/start-a-project" className="btn-primary">Start a Project</Link>
            <Link to="/quote" className="bg-transparent border border-gray-400 text-white hover:bg-white/10 px-6 py-3 rounded-md font-medium">
              Get a Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

// Helpful filler card to balance the grid and reinforce the lifecycle.
const ArticleMutations: React.FC = () => (
  <article className="card bg-blue-50 border-blue-200 p-6 flex flex-col">
    <h3 className="text-lg font-semibold text-gray-900 mb-2">Connecting the two lifecycles</h3>
    <p className="text-sm text-blue-800 leading-relaxed flex-1">
      The innovation pipeline feeds our commercial work. Research becomes experiments,
      experiments become prototypes, and validated prototypes become client projects
      or products.
    </p>
    <Link to="/solutions" className="btn-link mt-4 inline-flex items-center gap-1">Explore solutions</Link>
  </article>
)

export default InnovationPipeline
