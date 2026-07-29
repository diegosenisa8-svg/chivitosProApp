# -*- coding: utf-8 -*-
from pathlib import Path
from fpdf import FPDF

OUT = Path(__file__).resolve().parents[1] / "docs" / "ChivitosPro-Admin-Cambios.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)


def clean(text: str) -> str:
    table = str.maketrans(
        {
            "á": "a",
            "é": "e",
            "í": "i",
            "ó": "o",
            "ú": "u",
            "ñ": "n",
            "Á": "A",
            "É": "E",
            "Í": "I",
            "Ó": "O",
            "Ú": "U",
            "Ñ": "N",
            "ü": "u",
        }
    )
    return (
        text.translate(table)
        .replace("—", "-")
        .replace("–", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("…", "...")
        .replace("→", "->")
    )


pdf = FPDF()
pdf.set_auto_page_break(True, 15)
pdf.add_page()
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, clean("ChivitosPro - Panel Admin vs TuMenuWeb"), ln=1)
pdf.set_font("Helvetica", "", 10)
pdf.cell(0, 6, clean("Documento de cambios - julio 2026"), ln=1)
pdf.ln(4)

content = """
1. RESUMEN
Se reconstruyo el panel /admin de ChivitosPro para cubrir las capacidades del panel TuMenuWeb.com del video, mas mejoras propias de operacion.
Integraciones con credenciales reales muestran popup: "Ambiente de desarrollo, seccion se mostrara al pasar a produccion".

2. QUE SE AGREGO / CAMBIO
- Navegacion: Operaciones, Configuracion, Crecimiento
- Dashboard con KPIs y auto-refresh
- Pedidos + App toma de pedidos (aceptar/rechazar)
- Sonido al pedido nuevo + polling 8s
- Impresion de ticket
- Menu: crear/eliminar categorias y productos, reordenar, stock
- Opcionales y agregados (modifiers) por producto
- Vista previa / pedido de prueba
- Perfil, horarios, zonas de entrega Salto
- Payment methods & taxes
- Llamada de alerta (telefono supervisor)
- Publicar en / Pagos MP-PayPal / Marketing (UI + popup prod)
- Reportes 30 dias
- Backend: settings JSON, CRUD, reorder, modifiers, reports

3. POPUP DE DESARROLLO (SECCIONES PROD)
- Mercado Pago y PayPal
- Escuchar notificacion / llamada telefonica real
- Kickstarter, Autopilot, Google Business, QR externos
- Publicar en redes / escaner del sitio
- Dias especiales / festivos avanzados

4. MEJOR QUE EL PANEL DEL VIDEO
- Codigo y datos propios (sin SaaS con retirement 2027)
- PWA cliente + admin + branding ChivitosPro
- Estados de pedido granulares + rechazo
- Alertas sonoras nativas
- Ticket imprimible en navegador
- Reportes sobre PostgreSQL propia
- Modifiers editables y usados en checkout
- Deploy portable (Cloudflare + Railway)
- No finge integraciones: popup honesto de desarrollo
- App de toma embebida en el mismo panel

5. COMO PROBAR
- Backend: cd backend && npm run dev
- Front: npm run dev -> http://127.0.0.1:5173/admin
- Login: admin@chivitospro.com / chivitos2026

6. PROXIMOS PASOS PRODUCCION
- Mercado Pago con token real
- Twilio/similar para llamada real
- Poligonos GPS en mapa
- Upload de imagenes
- Roles caja/cocina/dueno
"""

pdf.set_font("Helvetica", "", 10)
for raw in content.strip().splitlines():
    line = clean(raw)
    if not line:
        pdf.ln(3)
        continue
    if line[0].isdigit() and ". " in line[:4]:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 11)
        pdf.multi_cell(180, 6, line)
        pdf.set_font("Helvetica", "", 10)
    else:
        pdf.multi_cell(180, 5.5, line)

pdf.output(str(OUT))
print(f"OK: {OUT}")
