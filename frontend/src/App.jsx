import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Error404 from "./pages/404.jsx";
import Portfolio from "./pages/Portfolio.jsx"
import Metrics from "./pages/Metrics.jsx"

function App() {
  return (
    <Router>
      <Routes>
        {/* Layout wrapper for all normal pages */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Portfolio />} />
          <Route path="analytics" element={<Metrics />} />

          {/* 👇 Catch-all 404 lives INSIDE the Layout */}
          <Route path="*" element={<Error404 />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
