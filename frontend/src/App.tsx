import React from "react"
import { RouterProvider, createBrowserRouter } from "react-router-dom"
import PublicLayout from "./layouts/PublicLayout"
import AdminLayout from "./layouts/AdminLayout"
import Home from "./pages/Home"
import Projects from "./pages/Projects"
import Research from "./pages/Research"
import Experiments from "./pages/Experiments"
import Blog from "./pages/Blog"
import BlogDetail from "./pages/BlogDetail"
import ResearchDetail from "./pages/ResearchDetail"
import ExperimentsDetail from "./pages/ExperimentsDetail"
import About from "./pages/About"
import GetAQuote from "./pages/GetAQuote"
import Solutions from "./pages/Solutions"
import PublicProducts from "./pages/Products"
import ProductDetail from "./pages/ProductDetail"
import StartAProject from "./pages/StartAProject"
import Journal from "./pages/Journal"
import BuildLog from "./pages/BuildLog"
import InnovationPipeline from "./pages/InnovationPipeline"
import Collaborate from "./pages/Collaborate"
import CMS from "./pages/CMS"
import NotFound from "./pages/NotFound"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import LeadsList from "./pages/admin/LeadsList"
import LeadDetails from "./pages/admin/LeadDetails"
import QuoteRequestsList from "./pages/admin/QuoteRequestsList"
import QuoteRequestDetail from "./pages/admin/QuoteRequestDetail"
import ProjectTypesAdmin from "./pages/admin/ProjectTypes"
import RequirementQuestionsAdmin from "./pages/admin/RequirementQuestions"
import Clients from "./pages/admin/Clients"
import Team from "./pages/admin/Team"
import Roles from "./pages/admin/Roles"
import KnowledgeBase from "./pages/admin/KnowledgeBase"
import Analytics from "./pages/admin/Analytics"
import EmailLogs from "./pages/admin/EmailLogs"
import WhatsAppLogs from "./pages/admin/WhatsAppLogs"
import QuotationsList from "./pages/admin/QuotationsList"
import QuotationDetails from "./pages/admin/QuotationDetails"
import ContractsList from "./pages/admin/ContractsList"
import ContractDetails from "./pages/admin/ContractDetails"
import ProjectsList from "./pages/admin/ProjectsList"
import NewProject from "./pages/admin/NewProject"
import ProjectDetails from "./pages/admin/ProjectDetails"
import Dashboard from "./pages/admin/Dashboard"
import CustomerProjectView from "./pages/CustomerProjectView"
import UserPanel from "./pages/UserPanel"
import Invoices from "./pages/admin/Invoices"
import InvoiceDetails from "./pages/admin/InvoiceDetails"
import Payments from "./pages/admin/Payments"
import SupportTickets from "./pages/admin/SupportTickets"
import SupportTicketDetails from "./pages/admin/SupportTicketDetails"
import Notifications from "./pages/admin/Notifications"
import CalendarPage from "./pages/admin/CalendarPage"
import Automation from "./pages/admin/Automation"
import Products from "./pages/admin/Products"
import Releases from "./pages/admin/Releases"
import Roadmap from "./pages/admin/Roadmap"
import Prototypes from "./pages/admin/Prototypes"
import FeatureFlags from "./pages/admin/FeatureFlags"
import ClientInvoicePortal from "./pages/ClientInvoicePortal"
import { RequireFeature } from "./components/RequireFeature"
import { AuthProvider } from "./store/authStore"
import WebsiteSettings from "./pages/admin/WebsiteSettings"
import CatalogAdmin from "./pages/admin/CatalogAdmin"
import SiteContent from "./pages/admin/SiteContent"
import CaseStudies from "./pages/admin/CaseStudies"
import Submissions from "./pages/admin/Submissions"
import SEO from "./pages/admin/SEO"
import AuditLogs from "./pages/admin/AuditLogs"
import Inventory from "./pages/admin/Inventory"
import RDAdmin from "./pages/admin/RDAdmin"

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "projects", element: <Projects /> },
      { path: "solutions", element: <Solutions /> },
      { path: "products", element: <PublicProducts /> },
      { path: "products/:slug", element: <ProductDetail /> },
      { path: "start-a-project", element: <StartAProject /> },
      { path: "innovation-pipeline", element: <InnovationPipeline /> },
      { path: "journal", element: <Journal /> },
      { path: "build-log", element: <BuildLog /> },
      { path: "collaborate", element: <Collaborate /> },
      { path: "blog", element: <Blog /> },
      { path: "blog/:slug", element: <BlogDetail /> },
      { path: "research", element: <Research /> },
      { path: "research/:slug", element: <ResearchDetail /> },
      { path: "experiments", element: <Experiments /> },
      { path: "experiments/:slug", element: <ExperimentsDetail /> },
      { path: "about", element: <About /> },
      { path: "quote", element: <GetAQuote /> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "project/:secureReference", element: <CustomerProjectView /> },
      { path: "user-panel", element: <UserPanel /> },
      { path: "invoice/:secureReference", element: <ClientInvoicePortal /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "leads", element: <LeadsList /> },
      { path: "leads/:leadId", element: <LeadDetails /> },
      { path: "quote-requests", element: <QuoteRequestsList /> },
      { path: "quote-requests/:quoteRequestId", element: <QuoteRequestDetail /> },
      { path: "project-types", element: <ProjectTypesAdmin /> },
      { path: "requirement-questions", element: <RequirementQuestionsAdmin /> },
      { path: "clients", element: <Clients /> },
      { path: "team", element: <Team /> },
      { path: "roles", element: <Roles /> },
      { path: "knowledge-base", element: <KnowledgeBase /> },
      { path: "analytics", element: <Analytics /> },
      { path: "email-logs", element: <EmailLogs /> },
      { path: "whatsapp-logs", element: <WhatsAppLogs /> },
      { path: "quotations", element: <QuotationsList /> },
      { path: "quotations/:quotationId", element: <QuotationDetails /> },
      { path: "contracts", element: <ContractsList /> },
      { path: "contracts/:contractId", element: <ContractDetails /> },
      { path: "projects", element: <ProjectsList /> },
      { path: "projects/new", element: <NewProject /> },
      { path: "projects/:projectId", element: <ProjectDetails /> },
      { path: "invoices", element: <RequireFeature feature="invoices"><Invoices /></RequireFeature> },
      { path: "invoices/:invoiceId", element: <RequireFeature feature="invoices"><InvoiceDetails /></RequireFeature> },
      { path: "payments", element: <RequireFeature feature="payments"><Payments /></RequireFeature> },
      { path: "support", element: <RequireFeature feature="support"><SupportTickets /></RequireFeature> },
      { path: "support/:ticketId", element: <RequireFeature feature="support"><SupportTicketDetails /></RequireFeature> },
      { path: "notifications", element: <RequireFeature feature="notifications"><Notifications /></RequireFeature> },
      { path: "calendar", element: <RequireFeature feature="calendar"><CalendarPage /></RequireFeature> },
      { path: "automation", element: <RequireFeature feature="automation"><Automation /></RequireFeature> },
      { path: "products", element: <RequireFeature feature="products"><Products /></RequireFeature> },
      { path: "releases", element: <RequireFeature feature="releases"><Releases /></RequireFeature> },
      { path: "roadmap", element: <RequireFeature feature="roadmaps"><Roadmap /></RequireFeature> },
      { path: "prototypes", element: <RequireFeature feature="prototypes"><Prototypes /></RequireFeature> },
      { path: "feature-flags", element: <RequireFeature feature="feature_flags"><FeatureFlags /></RequireFeature> },
      { path: "cms", element: <CMS /> },
      { path: "website", element: <WebsiteSettings /> },
      { path: "catalog", element: <CatalogAdmin /> },
      { path: "site-content", element: <SiteContent /> },
      { path: "case-studies", element: <CaseStudies /> },
      { path: "submissions", element: <Submissions /> },
      { path: "seo", element: <SEO /> },
      { path: "audit", element: <AuditLogs /> },
      { path: "inventory", element: <Inventory /> },
      { path: "rd", element: <RDAdmin /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "*", element: <NotFound /> },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App