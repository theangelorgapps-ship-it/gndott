import { MapPin } from 'lucide-react'
import { PersonalityCard } from './Personality'
import { img } from '../lib/imageUrls'
import { type Personality, type TitleLocation } from '../lib/personalityData'

export function TitlePeople({ cast = [], locations = [] }: { cast?: Personality[]; locations?: TitleLocation[] }) {
  return <section className="section detail-supplement about-panel" aria-label="About this title">
    <div className="about-grid">
      <div className="about-column">
        <div className="section-head"><h2>Personalities</h2></div>
        {cast.length ? <div className="about-people">{cast.map(person => <PersonalityCard key={person.id} person={person} />)}</div> : <p className="about-empty">No personality information is available for this title.</p>}
      </div>
      <div className="about-column">
        <div className="section-head"><h2>Locations</h2></div>
        {locations.length ? <div className="title-locations">{locations.map(location => <article className="title-location" key={location.id}>
          {location.file_url ? <img src={img(location.file_url)} alt="" loading="lazy" /> : <span className="title-location-icon" aria-hidden="true"><MapPin size={28} /></span>}
          <div><h3>{location.name}</h3>{location.address && <p>{location.address}</p>}</div>
        </article>)}</div> : <p className="about-empty">No location information is available for this title.</p>}
      </div>
    </div>
  </section>
}
