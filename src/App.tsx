import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useMigration } from "./hooks/useMigration";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const MigrationLoader = ({ children }: { children: React.ReactNode }) => {
  const { migrationStatus, migrationStats } = useMigration();

  if (migrationStatus === 'running') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">데이터 업그레이드 중</h2>
          <p className="text-gray-600 mb-4">
            저장된 사진들을 더 안전한 저장소로 이동하고 있습니다.
          </p>
          <div className="text-sm text-gray-500">
            잠시만 기다려주세요...
          </div>
        </div>
      </div>
    );
  }

  if (migrationStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">업그레이드 실패</h2>
          <p className="text-gray-600 mb-4">
            데이터 업그레이드 중 문제가 발생했습니다.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 마이그레이션 완료 시 성공 메시지 (한 번만 표시)
  if (migrationStatus === 'completed' && migrationStats && migrationStats.success > 0) {
    console.log(`Migration completed: ${migrationStats.success} photos migrated (${migrationStats.totalSizeMB}MB)`);
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <MigrationLoader>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MigrationLoader>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
