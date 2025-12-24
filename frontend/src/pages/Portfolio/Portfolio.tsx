import React, { useState, useEffect } from "react";
import "./Portfolio.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

type Position = {
  id: number | string;
  symbol: string;
  name?: string;
  positionType?: string;
  quantity: number;
  entryPrice?: number;
  currentPrice?: number;
  marketValue?: number;
  costBasis?: number;
};

export default function Portfolio() {
  const { session, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePnL = (position: Position) => {
    const marketValue = position.marketValue ?? 0;
    const costBasis = position.costBasis ?? 0;

    if ((position.positionType ?? "LONG").toUpperCase() === "LONG") {
      return marketValue - costBasis;
    } else {
      return costBasis - marketValue;
    }
  };

  const calculatePnLPercent = (position: Position) => {
    const pnl = calculatePnL(position);
    const costBasis = position.costBasis ?? 0;
    if (costBasis === 0) return 0;
    return (pnl / costBasis) * 100;
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
    const fetchPositions = async () => {
      setLoading(true);
      setError(null);

      try {
        const userId = session?.user?.id;
        if (!userId) {
          setPositions([]);
          setSummary({ totalValue: 0, totalPnL: 0, totalPnLPercent: 0 });
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

        // Fetch all trades for this user, ordered by time
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
          const symbol = trade.symbol ?? "";
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);

          // Use just symbol as key for netting
          const key = symbol;

          if (!positionsMap.has(key)) {
            positionsMap.set(key, {
              id: key,
              symbol,
              name: "",
              positionType: "LONG",
              quantity: 0,
              entryPrice: 0,
              currentPrice: 0,
              marketValue: 0,
              costBasis: 0,
            });
          }

          const position = positionsMap.get(key)!;

          if (side === "buy") {
            // Buying adds to position
            const oldQuantity = position.quantity;
            const oldCost = position.costBasis ?? 0;

            position.quantity += quantity;
            position.costBasis = oldCost + notional;

            if (position.quantity > 0) {
              position.entryPrice = position.costBasis / position.quantity;
              position.positionType = "LONG";
            }
          } else if (side === "sell") {
            // Selling reduces position
            const oldQuantity = position.quantity;
            position.quantity -= quantity;

            // Adjust cost basis proportionally
            if (oldQuantity > 0) {
              const remainingRatio =
                oldQuantity !== 0 ? position.quantity / oldQuantity : 0;
              position.costBasis =
                (position.costBasis ?? 0) * Math.max(0, remainingRatio);

              if (position.quantity > 0) {
                position.entryPrice = position.costBasis / position.quantity;
                position.positionType = "LONG";
              } else if (position.quantity < 0) {
                // Flipped to short
                position.positionType = "SHORT";
                position.costBasis = Math.abs(position.quantity) * price;
                position.entryPrice = price;
              } else {
                // Flat
                position.costBasis = 0;
                position.entryPrice = 0;
              }
            } else {
              // Opening short position or adding to short
              position.quantity -= quantity;
              position.positionType = "SHORT";
              position.costBasis = Math.abs(position.quantity) * price;
              position.entryPrice = price;
            }
          }
        });

        // Filter out flat positions (quantity = 0)
        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => pos.quantity !== 0
        );

        // Get unique symbols to fetch prices for
        const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];

        // Fetch current prices from API
        let priceMap = new Map<string, { price: number; name: string }>();

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
                  priceMap.set(item.symbol ?? item.ticker, {
                    price: Number(
                      item.price ?? item.last ?? item.close ?? item.current ?? 0
                    ),
                    name:
                      item.name ??
                      item.companyName ??
                      item.shortName ??
                      item.symbol,
                  });
                });
              } else {
                Object.entries(priceData).forEach(
                  ([symbol, data]: [string, any]) => {
                    priceMap.set(symbol, {
                      price: Number(
                        data.price ??
                          data.last ??
                          data.close ??
                          data.current ??
                          0
                      ),
                      name:
                        data.name ??
                        data.companyName ??
                        data.shortName ??
                        symbol,
                    });
                  }
                );
              }
            } else {
              console.warn("Price API returned error:", priceResponse.status);
            }
          } catch (priceError) {
            console.error("Failed to fetch prices:", priceError);
            aggregatedPositions.forEach((pos) => {
              priceMap.set(pos.symbol, {
                price: pos.entryPrice ?? 0,
                name: pos.symbol,
              });
            });
          }
        }

        // Merge prices into positions
        const enrichedPositions: Position[] = aggregatedPositions.map(
          (pos) => {
            const priceInfo = priceMap.get(pos.symbol);
            const currentPrice = priceInfo?.price ?? pos.entryPrice ?? 0;
            const name = priceInfo?.name ?? pos.symbol;

            return {
              ...pos,
              name,
              currentPrice,
              marketValue: Math.abs(pos.quantity) * currentPrice,
            };
          }
        );

        setPositions(enrichedPositions);

        // Calculate summary with cash balance
        const computedEquityValue = enrichedPositions.reduce((sum, pos) => {
          return sum + (pos.marketValue ?? 0);
        }, 0);

        const computedTotalCost = enrichedPositions.reduce((sum, pos) => {
          return sum + Math.abs(pos.costBasis ?? 0);
        }, 0);

        const cashBalance = initialCapital - computedTotalCost;
        const totalPortfolioValue = computedEquityValue + cashBalance;
        const computedTotalPnL = enrichedPositions.reduce(
          (sum, pos) => sum + calculatePnL(pos),
          0
        );
        const computedTotalPnLPercent =
          initialCapital === 0 ? 0 : (computedTotalPnL / initialCapital) * 100;

        setSummary({
          totalValue: totalPortfolioValue,
          totalPnL: computedTotalPnL,
          totalPnLPercent: computedTotalPnLPercent,
        });
      } catch (err: any) {
        console.error("Error fetching positions:", err?.message ?? err);
        setError(
          err?.message ?? "An error occurred while fetching positions"
        );
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchPositions();
  }, [session, authLoading]);

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h1>Portfolio Positions</h1>
        <div className="portfolio-summary">
          <div className="summary-card">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">
              {formatCurrency(summary.totalValue)}
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
            <span className="summary-label">Total Return</span>
            <span
              className={`summary-value ${
                summary.totalPnLPercent >= 0 ? "positive" : "negative"
              }`}
            >
              {formatPercent(summary.totalPnLPercent)}
            </span>
          </div>
        </div>
      </div>

      <div className="positions-table-container">
        {loading ? (
          <div className="loading">Loading positions…</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            <table className="positions-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th className="align-right">Quantity</th>
                  <th className="align-right">Entry Price</th>
                  <th className="align-right">Current Price</th>
                  <th className="align-right">Market Value</th>
                  <th className="align-right">P&L ($)</th>
                  <th className="align-right">P&L (%)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const pnl = calculatePnL(position);
                  const pnlPercent = calculatePnLPercent(position);

                  return (
                    <tr key={position.id} className="position-row">
                      <td className="symbol-cell">
                        <strong>{position.symbol}</strong>
                      </td>
                      <td className="name-cell">{position.name}</td>
                      <td>
                        <span
                          className={`position-badge ${(
                            position.positionType ?? ""
                          ).toLowerCase()}`}
                        >
                          {position.positionType}
                        </span>
                      </td>
                      <td className="align-right">
                        {Math.abs(position.quantity)}
                      </td>
                      <td className="align-right">
                        {formatCurrency(position.entryPrice ?? 0)}
                      </td>
                      <td className="align-right">
                        {formatCurrency(position.currentPrice ?? 0)}
                      </td>
                      <td className="align-right">
                        {formatCurrency(position.marketValue ?? 0)}
                      </td>
                      <td
                        className={`align-right ${
                          pnl >= 0 ? "positive" : "negative"
                        }`}
                      >
                        {formatCurrency(pnl)}
                      </td>
                      <td
                        className={`align-right ${
                          pnlPercent >= 0 ? "positive" : "negative"
                        }`}
                      >
                        {formatPercent(pnlPercent)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {positions.length === 0 && (
              <div className="empty-state">
                <p>
                  No positions found. Start trading to see your portfolio here.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}