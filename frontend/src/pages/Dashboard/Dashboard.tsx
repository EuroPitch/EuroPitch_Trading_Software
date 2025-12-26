import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

type PortfolioSummary = {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  cashBalance: number;
  initialCapital: number;
  positionCount: number;
};

type TradingStats = {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalVolume: number;
  averageTradeSize: number;
  mostTradedStock: string;
  mostTradedCount: number;
  tradesToday: number;
  tradesThisWeek: number;
  totalNotional: number;
};

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    cashBalance: 0,
    initialCapital: 100000,
    positionCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradingStats, setTradingStats] = useState<TradingStats>({
    totalTrades: 0,
    buyTrades: 0,
    sellTrades: 0,
    totalVolume: 0,
    averageTradeSize: 0,
    mostTradedStock: "-",
    mostTradedCount: 0,
    tradesToday: 0,
    tradesThisWeek: 0,
    totalNotional: 0,
  });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userEmail");
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-UK", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const userId = session?.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        // Fetch initial capital from profiles table
        let initialCapital = 100000;
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("initial_capital")
            .eq("id", userId)
            .single();

          if (profileData?.initial_capital) {
            initialCapital = Number(profileData.initial_capital);
          }
        } catch (err) {
          console.warn("Could not fetch initial capital, using default €100k");
        }

        // Fetch all trades for this user
        const { data: tradesData, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", userId)
          .order("placed_at", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        // Aggregate trades with position netting
        const positionsMap = new Map<string, any>();

        (tradesData ?? []).forEach((trade: any) => {
          const symbol = trade.symbol ?? "";
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);

          const key = symbol;

          if (!positionsMap.has(key)) {
            positionsMap.set(key, {
              symbol,
              quantity: 0,
              costBasis: 0,
            });
          }

          const position = positionsMap.get(key)!;

          if (side === "buy") {
            const oldQuantity = position.quantity;
            const oldCost = position.costBasis ?? 0;

            position.quantity += quantity;
            position.costBasis = oldCost + notional;
          } else if (side === "sell") {
            const oldQuantity = position.quantity;
            position.quantity -= quantity;

            if (oldQuantity > 0) {
              const remainingRatio =
                oldQuantity !== 0 ? position.quantity / oldQuantity : 0;
              position.costBasis =
                (position.costBasis ?? 0) * Math.max(0, remainingRatio);
            } else {
              position.costBasis = Math.abs(position.quantity) * price;
            }
          }
        });

        // Filter out flat positions
        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => pos.quantity !== 0
        );

        // Get unique symbols to fetch prices for
        const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];

        // Fetch current prices from API
        let priceMap = new Map<string, number>();

        if (symbols.length > 0) {
          try {
            const symbolParams = symbols.map((s) => `symbols=${s}`).join("&");
            const priceResponse = await fetch(
              `https://europitch-trading-prices.vercel.app/equities/quotes?${symbolParams}&chunk_size=50`
            );

            if (priceResponse.ok) {
              const priceData = await priceResponse.json();

              if (Array.isArray(priceData)) {
                priceData.forEach((item: any) => {
                  priceMap.set(
                    item.symbol ?? item.ticker,
                    Number(
                      item.price ??
                        item.last ??
                        item.close ??
                        item.current ??
                        0
                    )
                  );
                });
              } else {
                Object.entries(priceData).forEach(([symbol, data]: [string, any]) => {
                  priceMap.set(
                    symbol,
                    Number(
                      data.price ??
                        data.last ??
                        data.close ??
                        data.current ??
                        0
                    )
                  );
                });
              }
            }
          } catch (priceError) {
            console.error("Failed to fetch prices:", priceError);
          }
        }

        // Calculate portfolio values
        const computedEquityValue = aggregatedPositions.reduce((sum, pos) => {
          const priceFromMap = priceMap.get(pos.symbol);
          const currentPrice = priceFromMap ?? (pos.quantity !== 0 ? pos.costBasis / Math.abs(pos.quantity) : 0);
          return sum + Math.abs(pos.quantity) * currentPrice;
        }, 0);

        const computedTotalCost = aggregatedPositions.reduce((sum, pos) => {
          return sum + Math.abs(pos.costBasis ?? 0);
        }, 0);

        const cashBalance = initialCapital - computedTotalCost;
        const totalPortfolioValue = computedEquityValue + cashBalance;
        const computedTotalPnL = aggregatedPositions.reduce((sum, pos) => {
          const priceFromMap = priceMap.get(pos.symbol);
          const currentPrice = priceFromMap ?? (pos.quantity !== 0 ? pos.costBasis / Math.abs(pos.quantity) : 0);
          const marketValue = Math.abs(pos.quantity) * currentPrice;
          const costBasis = Math.abs(pos.costBasis ?? 0);
          
          if (pos.quantity > 0) {
            return sum + (marketValue - costBasis);
          } else {
            return sum + (costBasis - marketValue);
          }
        }, 0);
        
        const computedTotalPnLPercent =
          initialCapital === 0 ? 0 : (computedTotalPnL / initialCapital) * 100;

        setSummary({
          totalValue: totalPortfolioValue,
          totalPnL: computedTotalPnL,
          totalPnLPercent: computedTotalPnLPercent,
          cashBalance: cashBalance,
          initialCapital: initialCapital,
          positionCount: aggregatedPositions.length,
        });

        // Calculate trading statistics
        const trades = tradesData ?? [];
        const buyTrades = trades.filter((t: any) => (t.side ?? "buy").toLowerCase() === "buy").length;
        const sellTrades = trades.filter((t: any) => (t.side ?? "sell").toLowerCase() === "sell").length;
        const totalVolume = trades.reduce((sum: number, t: any) => sum + Number(t.quantity ?? 0), 0);
        const totalNotional = trades.reduce((sum: number, t: any) => sum + Number(t.notional ?? (Number(t.quantity ?? 0) * Number(t.price ?? 0))), 0);
        const averageTradeSize = trades.length > 0 ? totalNotional / trades.length : 0;

        // Find most traded stock
        const stockCounts = new Map<string, number>();
        trades.forEach((t: any) => {
          const symbol = t.symbol ?? "";
          if (symbol) {
            stockCounts.set(symbol, (stockCounts.get(symbol) ?? 0) + 1);
          }
        });
        let mostTradedStock = "-";
        let mostTradedCount = 0;
        stockCounts.forEach((count, symbol) => {
          if (count > mostTradedCount) {
            mostTradedCount = count;
            mostTradedStock = symbol;
          }
        });

        // Calculate trades today and this week
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const tradesToday = trades.filter((t: any) => {
          const tradeDate = new Date(t.placed_at ?? t.filled_at ?? "");
          return tradeDate >= today;
        }).length;

        const tradesThisWeek = trades.filter((t: any) => {
          const tradeDate = new Date(t.placed_at ?? t.filled_at ?? "");
          return tradeDate >= weekAgo;
        }).length;

        setTradingStats({
          totalTrades: trades.length,
          buyTrades,
          sellTrades,
          totalVolume,
          averageTradeSize,
          mostTradedStock,
          mostTradedCount,
          tradesToday,
          tradesThisWeek,
          totalNotional,
        });
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err?.message ?? err);
        setError(err?.message ?? "An error occurred while fetching dashboard data");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchDashboardData();
  }, [session, authLoading]);

  const userEmail = session?.user?.email || localStorage.getItem("userEmail") || "User";

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome back, {userEmail.split("@")[0]}!</h1>
          <p className="welcome-subtitle">Here's an overview of your trading account</p>
        </div>
        <button
          className="dashboard-logout-button"
          onClick={handleLogout}
          aria-label="Log out"
        >
          Log Out
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading dashboard...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <div className="dashboard-summary">
            <div className="summary-card main-card">
              <span className="summary-label">Portfolio Value</span>
              <span className="summary-value large">
                {formatCurrency(summary.totalValue)}
              </span>
              <span
                className={`summary-change ${
                  summary.totalPnLPercent >= 0 ? "positive" : "negative"
                }`}
              >
                {formatPercent(summary.totalPnLPercent)}
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Total P&L</span>
              <span
                className={`summary-value ${
                  summary.totalPnL >= 0 ? "positive" : "negative"
                }`}
              >
                {formatCurrency(summary.totalPnL)}
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Cash Balance</span>
              <span className="summary-value">
                {formatCurrency(summary.cashBalance)}
              </span>
            </div>

            <div className="summary-card">
              <span className="summary-label">Active Positions</span>
              <span className="summary-value">{summary.positionCount}</span>
            </div>
          </div>

          <div className="stats-overview">
            <h2>Trading Statistics</h2>
            <div className="stats-table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="align-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Trades</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.totalTrades}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Buy Orders</td>
                    <td className="align-right">
                      <span className="stat-value positive">{tradingStats.buyTrades}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Sell Orders</td>
                    <td className="align-right">
                      <span className="stat-value negative">{tradingStats.sellTrades}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Volume</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.totalVolume.toLocaleString()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Notional</td>
                    <td className="align-right">
                      <span className="stat-value">{formatCurrency(tradingStats.totalNotional)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Avg Trade Size</td>
                    <td className="align-right">
                      <span className="stat-value">{formatCurrency(tradingStats.averageTradeSize)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Most Traded Stock</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.mostTradedStock}</span>
                      {tradingStats.mostTradedCount > 0 && (
                        <span className="stat-sublabel"> ({tradingStats.mostTradedCount} trades)</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Trades Today</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.tradesToday}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Trades This Week</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.tradesThisWeek}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-actions">
            <h2>Quick Actions</h2>
            <div className="action-cards">
              <Link to="/portfolio" className="action-card">
                <div className="action-icon">📊</div>
                <h3>View Portfolio</h3>
                <p>See all your positions and detailed performance</p>
              </Link>

              <Link to="/stocks" className="action-card">
                <div className="action-icon">📈</div>
                <h3>Browse Stocks</h3>
                <p>Explore and trade stocks</p>
              </Link>

              <div className="action-card">
                <div className="action-icon">💰</div>
                <h3>Initial Capital</h3>
                <p>{formatCurrency(summary.initialCapital)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

