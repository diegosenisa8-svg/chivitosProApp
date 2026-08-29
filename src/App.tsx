import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { ThemeToggle } from './components/ThemeToggle'
import { CartProvider } from './context/CartContext'
import { CustomerAuthProvider, useCustomerAuth } from './context/CustomerAuthContext'
import { MenuProvider } from './context/MenuContext'
import { MenuCartBridge } from './context/MenuCartBridge'
import { ThemeProvider } from './context/ThemeContext'
import { applyTheme } from './lib/theme'
import { AdminPage } from './pages/AdminPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ConfirmPage } from './pages/ConfirmPage'
import { CustomerAuthPage } from './pages/CustomerAuthPage'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { MyOrdersPage } from './pages/MyOrdersPage'
import { ProductPage } from './pages/ProductPage'
import './App.css'

function CustomerGate({ children }: { children: ReactNode }) {
  const { customer, booting } = useCustomerAuth()
  if (booting) {
    return (
      <div className="page">
        <p className="empty">Cargando…</p>
      </div>
    )
  }
  if (!customer) return <CustomerAuthPage />
  return <>{children}</>
}

function AppRoutes() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  useEffect(() => {
    if (isAdmin) {
      applyTheme('light')
      document.documentElement.classList.add('admin-tm')
      document.documentElement.style.colorScheme = 'light'
    } else {
      document.documentElement.classList.remove('admin-tm')
    }
  }, [isAdmin])

  return (
    <div className={isAdmin ? 'admin-root' : 'app-shell'}>
      {!isAdmin ? <ThemeToggle /> : null}
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/confirm" element={<ConfirmPage />} />
        <Route
          path="/checkout"
          element={
            <CustomerGate>
              <CheckoutPage />
            </CustomerGate>
          }
        />
        <Route
          path="/mis-pedidos"
          element={
            <CustomerGate>
              <MyOrdersPage />
            </CustomerGate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <MenuProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <MenuCartBridge />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </CartProvider>
        </CustomerAuthProvider>
      </MenuProvider>
    </ThemeProvider>
  )
}
