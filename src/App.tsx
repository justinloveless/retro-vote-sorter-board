import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GlobalBackground } from "@/components/ui/GlobalBackground";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import { OrgSelectorProvider } from "@/contexts/OrgSelectorContext";
import Index from "./pages/Index";
import Retro from "./pages/Retro";
import Teams from "./pages/Teams";
import Team from "./pages/Team";
import TeamSettingsPage from "./pages/TeamSettings";
import Account from "./pages/Account";
import InviteAccept from "./pages/InviteAccept";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import NeotroPage from "./pages/NeotroPage";
import AnonymousPokerPage from "./pages/AnonymousPokerPage";
import Billing from "./pages/Billing";
import Notifications from "./pages/Notifications";
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminPage from "./pages/AdminPage";
import AdminSubscriptionsPage from "./pages/admin/AdminSubscriptionsPage";
import AdminFeatureFlagsPage from "./pages/admin/AdminFeatureFlagsPage";
import AdminTierLimitsPage from "./pages/admin/AdminTierLimitsPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminUsersTeamsPage from "./pages/admin/AdminUsersTeamsPage";
import AdminIntegrationsPage from "./pages/admin/AdminIntegrationsPage";
import OrgDashboard from "./pages/OrgDashboard";
import OrgAdmin from "./pages/OrgAdmin";
import OrgInviteAccept from "./pages/OrgInviteAccept";
import JoinOrg from "./pages/JoinOrg";
import { AudioPlayerProvider } from "./context/AudioPlayerContext";
import { AuthProvider } from "./hooks/useAuth";
import { TeamDataProvider } from "./contexts/TeamDataContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <BackgroundProvider>
          <FeatureFlagProvider>
            <OrgSelectorProvider>
            <TeamDataProvider>
              <TooltipProvider>
                <AudioPlayerProvider>
                <GlobalBackground />
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/retro/:roomId" element={<Retro />} />
                  <Route path="/poker/:roomId" element={<AnonymousPokerPage />} />
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/teams/:teamId" element={<Team />} />
                  <Route path="/teams/:teamId/settings" element={<TeamSettingsPage />} />
                  <Route path="/teams/:teamId/poker/:sessionId" element={<NeotroPage />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/invite/:token" element={<InviteAccept />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/notifications" element={<Notifications />} />

                  {/* Organization Routes */}
                  <Route path="/org/:slug" element={<OrgDashboard />} />
                  <Route path="/org/:slug/admin" element={<OrgAdmin />} />
                  <Route path="/org-invite/:token" element={<OrgInviteAccept />} />
                  <Route path="/join-org/:code" element={<JoinOrg />} />

                  {/* Admin Routes */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminPage />} />
                    <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
                    <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
                    <Route path="tier-limits" element={<AdminTierLimitsPage />} />
                    <Route path="notifications" element={<AdminNotificationsPage />} />
                    <Route path="users-teams" element={<AdminUsersTeamsPage />} />
                    <Route path="integrations" element={<AdminIntegrationsPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
                </AudioPlayerProvider>
              </TooltipProvider>
            </TeamDataProvider>
            </OrgSelectorProvider>
          </FeatureFlagProvider>
        </BackgroundProvider>
      </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
