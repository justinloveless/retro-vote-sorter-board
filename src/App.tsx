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
import TeamSettings from "./pages/TeamSettings";
import Account from "./pages/Account";
import InviteAccept from "./pages/InviteAccept";
import NotFound from "./pages/NotFound";
import NeotroPage from "./pages/NeotroPage";
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminPage from "./pages/AdminPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BackgroundProvider>
        <FeatureFlagProvider>
          <TooltipProvider>
            <GlobalBackground />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/retro/:roomId" element={<Retro />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/teams/:teamId" element={<Team />} />
                <Route path="/teams/:teamId/settings" element={<TeamSettings />} />
                <Route path="/teams/:teamId/neotro" element={<NeotroPage />} />
                <Route path="/account" element={<Account />} />
                <Route path="/invite/:token" element={<InviteAccept />} />

                {/* Admin Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </FeatureFlagProvider>
      </BackgroundProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
