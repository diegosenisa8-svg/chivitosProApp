import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { MenuProvider } from './context/MenuContext'
import { CartPage } from './pages/CartPage'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { ProductPage } from './pages/ProductPage'
import './App.css'

export default function App() {
  return (
    <MenuProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="app-shell">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </CartProvider>
    </MenuProvider>
  )
}
