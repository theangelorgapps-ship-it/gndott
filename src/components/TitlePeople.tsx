import { MapPin } from 'lucide-react'
import { PersonalityCard } from './Personality'
import { ExpandableAvatarPill } from './ExpandableAvatarPill'
import { img } from '../lib/imageUrls'
import { type Personality, type TitleLocation } from '../lib/personalityData'

export function TitlePeople({ cast = [], locations = [] }: { cast?: Personality[]; locations?: TitleLocation[] }) {
  return <section className="section detail-supplement about-panel" aria-label="About this title">
    <div className="title-about-groups">
      {cast.length ? <ExpandableAvatarPill title="Personalities" countLabel={cast.length === 1 ? 'person' : 'people'} items={cast}>
        <div className="title-about-people">{cast.map(person => <PersonalityCard key={person.id} person={person} />)}</div>
      </ExpandableAvatarPill> : <p className="title-about-empty">No personality information is available for this title.</p>}
      {locations.length ? <ExpandableAvatarPill title="Locations" countLabel={locations.length === 1 ? 'location' : 'locations'} items={locations} locations>
        <div className="title-about-locations">{locations.map(location => <article className="title-location" key={location.id}>
          {location.file_url ? <img src={img(location.file_url)} alt="" loading="lazy" /> : <span className="title-location-icon" aria-hidden="true"><MapPin size={28} /></span>}
          <div><h3>{location.name}</h3>{location.address && <p>{location.address}</p>}</div>
        </article>)}</div>
      </ExpandableAvatarPill> : <p className="title-about-empty">No location information is available for this title.</p>}
    </div>
  </section>
}
