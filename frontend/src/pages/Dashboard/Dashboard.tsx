import React, { useState, useEffect, useRef } from "react";
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

type Position = {
  symbol: string;
  quantity: number;
  costBasis: number;
  entryPrice: number;
  positionType: "LONG" | "SHORT";
};

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [initialCapital, setInitialCapital] = useState(100000);
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

  // Position-aware P&L calculation using current market price
  const calculatePnL = (position: Position, currentPrice: number): number => {
    if (currentPrice === 0 || position.entryPrice === 0 || position.quantity === 0) {
      return 0;
    }

    const quantity = Math.abs(position.quantity);
    
    if (position.positionType === "LONG") {
      // LONG: profit when currentPrice > entryPrice
      return (currentPrice - position.entryPrice) * quantity;
    } else {
      // SHORT: profit when currentPrice < entryPrice
      return (position.entryPrice - currentPrice) * quantity;
    }
  };

  // Fetch prices from API
  const fetchPrices = async (symbols: string[]): Promise<Map<string, number>> => {
    const priceMap = new Map<string, number>();
    
    if (symbols.length === 0) return priceMap;

    try {
      const symbolParams = symbols.map((s) => `symbols=${s}`).join("&");
      const priceResponse = await fetch(
        `https://europitch-trading-prices.vercel.app/equities/quotes?${symbolParams}&chunk_size=50`
      );

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();

        if (Array.isArray(priceData)) {
          priceData.forEach((item: any) => {
            const symbol = (item.symbol ?? item.ticker ?? "").toUpperCase().trim();
            const price = Number(
              item.price ?? item.last ?? item.close ?? item.current ?? 0
            );
            if (symbol && price > 0) {
              priceMap.set(symbol, price);
            }
          });
        } else {
          Object.entries(priceData).forEach(([key, data]: [string, any]) => {
            const symbol = key.toUpperCase().trim();
            const price = Number(
              data.price ?? data.last ?? data.close ?? data.current ?? 0
            );
            if (symbol && price > 0) {
              priceMap.set(symbol, price);
            }
          });
        }
      }
    } catch (priceError) {
      console.error("Failed to fetch prices:", priceError);
    }

    return priceMap;
  };

  // Recalculate portfolio metrics from current positions and prices
  // This function is called whenever positions or prices change
  useEffect(() => {
    if (positions.length === 0) {
      setSummary({
        totalValue: initialCapital,
        totalPnL: 0,
        totalPnLPercent: 0,
        cashBalance: initialCapital,
        initialCapital,
        positionCount: 0,
      });
      return;
    }

    // Calculate total market value and P&L using current prices
    let totalMarketValue = 0;
    let totalPnL = 0;

    positions.forEach((pos) => {
      const currentPrice = priceMap.get(pos.symbol.toUpperCase().trim()) ?? 0;
      
      if (currentPrice > 0) {
        const quantity = Math.abs(pos.quantity);
        const marketValue = quantity * currentPrice;
        totalMarketValue += marketValue;
        totalPnL += calculatePnL(pos, currentPrice);
      }
    });

    // Calculate cost basis
    const totalCostBasis = positions.reduce(
      (sum, pos) => sum + Math.abs(pos.costBasis),
      0
    );

    const cashBalance = initialCapital - totalCostBasis;
    const totalPortfolioValue = totalMarketValue + cashBalance;
    const totalReturn = initialCapital === 0 ? 0 : (totalPnL / initialCapital) * 100;

    setSummary({
      totalValue: totalPortfolioValue,
      totalPnL,
      totalPnLPercent: totalReturn,
      cashBalance,
      initialCapital,
      positionCount: positions.length,
    });
  }, [positions, priceMap, initialCapital]);

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
        const positionsMap = new Map<string, Position>();

        (tradesData ?? []).forEach((trade: any) => {
          const symbol = (trade.symbol ?? "").toUpperCase().trim();
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);

          if (!positionsMap.has(symbol)) {
            positionsMap.set(symbol, {
              symbol,
              quantity: 0,
              costBasis: 0,
              entryPrice: 0,
              positionType: "LONG",
            });
          }

          const position = positionsMap.get(symbol)!;

          if (side === "buy") {
            const oldQuantity = position.quantity;
            const oldCost = position.costBasis;

            position.quantity += quantity;
            position.costBasis = oldCost + notional;

            if (position.quantity > 0) {
              position.entryPrice = position.costBasis / position.quantity;
              position.positionType = "LONG";
            } else if (position.quantity < 0) {
              position.entryPrice = price;
              position.positionType = "SHORT";
            }
          } else if (side === "sell") {
            const oldQuantity = position.quantity;
            position.quantity -= quantity;

            if (oldQuantity > 0) {
              // Closing or reducing LONG position
              const remainingRatio =
                oldQuantity !== 0 ? position.quantity / oldQuantity : 0;
              position.costBasis = position.costBasis * Math.max(0, remainingRatio);

              if (position.quantity > 0) {
                position.entryPrice = position.costBasis / position.quantity;
                position.positionType = "LONG";
              } else if (position.quantity < 0) {
                // Flipped to SHORT
                position.entryPrice = price;
                position.positionType = "SHORT";
                position.costBasis = Math.abs(position.quantity) * price;
              }
            } else {
              // Opening or adding to SHORT position
              position.entryPrice = price;
              position.positionType = "SHORT";
              position.costBasis = Math.abs(position.quantity) * price;
            }
          }
        });

        // Filter out flat positions
        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => pos.quantity !== 0
        );

        // Store positions
        setPositions(aggregatedPositions);
        setInitialCapital(initialCapital);

        // Get unique symbols to fetch prices for
        const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];

        // Fetch prices and update metrics
        const updatePrices = async () => {
          const prices = await fetchPrices(symbols);
          setPriceMap(prices);
        };

        // Initial price fetch
        await updatePrices();

        // Clear any existing interval
        if (priceIntervalRef.current) {
          clearInterval(priceIntervalRef.current);
        }

        // Refresh prices every 15 seconds
        priceIntervalRef.current = setInterval(updatePrices, 15_000);

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

    // Cleanup interval on unmount
    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
    };
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

