// App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Error404 from "./pages/404";
import Portfolio from "./pages/Portfolio/Portfolio";
import StockMetrics from "./pages/Stocks/StockMetrics";
import Standings from "./pages/Standings/Standings";
import Login from "./pages/Auth/Login";
import { ProtectedRoute } from "./ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="stocks" element={<StockMetrics />} />
          </Route>

          <Route path="*" element={<Error404 />} />
        </Route>
        <Route path="/standings" element={<Standings />} />
      </Routes>
    </Router>
  );
}

export default App;