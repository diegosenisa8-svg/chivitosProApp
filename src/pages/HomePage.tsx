import { Link } from 'react-router-dom'
import { FulfillmentToggle } from '../components/FulfillmentToggle'
import { Toast } from '../components/Toast'
import { useCart } from '../context/CartContext'
import { useMenu } from '../context/MenuContext'
import { formatMoney } from '../lib/format'

export function HomePage() {
  const { menu, loading } = useMenu()
  const { fulfillment } = useCart()
  const r = menu.restaurant

  return (
    <div className="home">
      <Toast />
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

      <section className="home-card">
        <div className="home-card-top">
          <div className="home-brand">
            <img src={r.logo} alt="" className="home-logo" />
            <div>
              <h1>{r.name}</h1>
              <p className="home-address">{r.address}</p>
            </div>
          </div>
          <span className={`badge ${r.open ? 'open' : 'closed'}`}>
            {loading ? '…' : r.open ? 'ABIERTO' : 'CERRADO'}
          </span>
        </div>

        <div className="home-meta">
          <span>{r.hoursLabel}</span>
          <span>
            {r.etaMin}–{r.etaMax} min
          </span>
          <span>{r.distanceKm.toFixed(1).replace('.', ',')} km</span>
        </div>

        <FulfillmentToggle />

        <p className="home-fee">
          {fulfillment === 'delivery'
            ? `Envío ${formatMoney(r.deliveryFee || 80)} · Mínimo ${formatMoney(r.minOrder || 250)}`
            : 'Retiro en el local · Sin costo de envío'}
        </p>

        <Link to="/menu" className="btn btn-primary home-cta">
          Ver menú
        </Link>
      </section>
    </div>
  )
}
