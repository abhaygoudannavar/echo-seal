/* Server component: no interactivity, so it ships no JavaScript. */

const TEAM = [
  { slug: 'suhaan', name: 'Suhaan Raqeeb Khavas', role: 'Watermarking and audio' },
  { slug: 'lavanya', name: 'Lavanya Yadwad', role: 'Backend and infrastructure' },
  { slug: 'abhay', name: 'Abhay Goudannavar', role: 'Frontend and design' },
  { slug: 'sahana', name: 'Sahana KB', role: 'Integration and demo' },
];

export default function Team() {
  return (
    <section className="section" id="team">
      <h2>Who built this</h2>
      <p>Four of us, over a weekend, for the WeMakeDevs First Commit hackathon.</p>
      <ul className="team">
        {TEAM.map((m) => (
          <li className="team__member" key={m.slug}>
            {/* Plain img: next/image needs a loader the static export does not have. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="team__photo"
              src={`/img/team/${m.slug}.jpg`}
              alt={m.name}
              width="400"
              height="400"
              loading="lazy"
            />
            <span className="team__name">{m.name}</span>
            <span className="team__role">{m.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
