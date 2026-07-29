import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ChatAssistant } from './components/ChatAssistant'
import { ThemeToggle } from './components/ThemeToggle'
import { CartProvider } from './context/CartContext'
import { MenuProvider } from './context/MenuContext'
import { ThemeProvider } from './context/ThemeContext'
import { AdminPage } from './pages/AdminPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ConfirmPage } from './pages/ConfirmPage'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { ProductPage } from './pages/ProductPage'
import './App.css'

function AppRoutes() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className={isAdmin ? 'admin-root' : 'app-shell'}>
      <ThemeToggle className={isAdmin ? 'theme-toggle--admin' : ''} />
      {!isAdmin && <ChatAssistant />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/confirm" element={<ConfirmPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <MenuProvider>
        <CartProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </CartProvider>
      </MenuProvider>
    </ThemeProvider>
  )
}
