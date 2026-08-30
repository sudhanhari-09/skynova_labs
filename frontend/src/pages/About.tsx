import React, { useCallback, useEffect, useState } from "react"
import { fetchTeam, fetchAchievements, fetchFaqs, fetchTestimonials, TeamMember, Achievement, Faq, Testimonial } from "../services/api"

const About: React.FC = () => {
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [achievements, setAchievements] = useState<Achievement[] | null>(null)
  const [faqs, setFaqs] = useState<Faq[] | null>(null)
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null)

  const load = useCallback(() => {
    fetchTeam().then(setTeam).catch(() => setTeam([]))
    fetchAchievements().then(setAchievements).catch(() => setAchievements([]))
    fetchFaqs().then(setFaqs).catch(() => setFaqs([]))
    fetchTestimonials().then(setTestimonials).catch(() => setTestimonials([]))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About</h1>
        <p className="text-gray-600 leading-relaxed max-w-3xl">
          Project Labs is a technology research and development company focused on
          innovative software solutions, from idea to deployment.
        </p>
        <section className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Our Approach</h2>
          <p className="text-gray-600 leading-relaxed">
            We combine research, experimentation, and disciplined delivery to turn
            ambitious ideas into reliable products.
          </p>
        </section>

        {achievements !== null && achievements.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Achievements</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.slice(0, 6).map((a) => (
                <div key={a.id} className="bg-white rounded-lg shadow p-5">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{a.metric || "—"}</div>
                  <div className="font-medium text-gray-900">{a.title}</div>
                  {a.description && <p className="text-sm text-gray-500 mt-1">{a.description}</p>}
                  {a.achievement_date && <div className="text-xs text-gray-400 mt-2">{new Date(a.achievement_date).toLocaleDateString()}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {team !== null && team.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Team</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {team.map((m) => (
                <div key={m.id} className="bg-white rounded-lg shadow p-5">
                  {m.photo_url && <img src={m.photo_url} alt="" className="w-16 h-16 rounded-full object-cover mb-3" />}
                  <div className="font-semibold text-gray-900">{m.name}</div>
                  <div className="text-sm text-blue-600">{m.position}{m.department ? ` · ${m.department}` : ""}</div>
                  {m.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{m.bio}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {faqs !== null && faqs.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">FAQ</h2>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.id} className="bg-white rounded-lg shadow px-5 py-4">
                  <summary className="font-medium text-gray-900 cursor-pointer">{f.question}</summary>
                  <p className="text-gray-600 mt-2">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {testimonials !== null && testimonials.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Testimonials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testimonials.slice(0, 6).map((t) => (
                <figure key={t.id} className="bg-white rounded-lg shadow p-5">
                  <blockquote className="text-gray-600">“{t.content}”</blockquote>
                  <figcaption className="text-sm mt-3">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    {(t.role || t.company) && <span className="text-gray-500"> — {[t.role, t.company].filter(Boolean).join(", ")}</span>}
                    {t.rating && <span className="text-amber-500 ml-2">{"★".repeat(Math.min(5, Math.max(1, Math.round(t.rating))))}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default About