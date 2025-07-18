import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GlobalBackground } from "@/components/ui/GlobalBackground";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
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
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminPage from "./pages/AdminPage";
import { AudioPlayerProvider } from "./context/AudioPlayerContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BackgroundProvider>
        <FeatureFlagProvider>
          <TooltipProvider>
            <AudioPlayerProvider>
              <GlobalBackground />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/retro/:roomId" element={<Retro />} />
                  <Route path="/poker/:roomId" element={<AnonymousPokerPage />} />
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/teams/:teamId" element={<Team />} />
                  <Route path="/teams/:teamId/settings" element={<TeamSettingsPage />} />
                  <Route path="/teams/:teamId/neotro" element={<NeotroPage />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/invite/:token" element={<InviteAccept />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Admin Routes */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </AudioPlayerProvider>
          </TooltipProvider>
        </FeatureFlagProvider>
      </BackgroundProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
