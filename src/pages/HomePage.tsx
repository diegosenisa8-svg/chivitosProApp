import { Link } from 'react-router-dom'
import { useMenu } from '../context/MenuContext'

export function HomePage() {
  const { menu, loading } = useMenu()
  const r = menu.restaurant

  return (
    <div className="home">
      <div className="home-map">
        <iframe
          title="Mapa ChivitosPro"
          src={r.mapEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="home-pin">
          <span className="home-pin-dot" />
          <span className="home-pin-label">{r.name}</span>
        </div>
      </div>

      <Link to="/menu" className="home-card">
        <div className="home-card-top">
          <h1>{r.name}</h1>
          <span className={`badge ${r.open ? 'open' : 'closed'}`}>
            {loading ? '…' : r.open ? 'ABIERTO' : 'CERRADO'}
          </span>
        </div>
        <p className="home-address">{r.address}</p>
        <div className="home-card-bottom">
          <div className="home-services">
            {r.delivery && (
              <span className="svc" aria-label="Delivery">
                <TruckIcon />
              </span>
            )}
            {r.takeaway && (
              <span className="svc" aria-label="Para llevar">
                <BagIcon />
              </span>
            )}
          </div>
          <span className="home-distance">{r.distanceKm.toFixed(1).replace('.', ',')} km</span>
        </div>
      </Link>
    </div>
  )
}

function TruckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="17.5" cy="17.5" r="1.5" />
    </svg>
  )
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}
