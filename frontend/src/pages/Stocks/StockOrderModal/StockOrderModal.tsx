import React, { useState } from "react";
import "./StockOrderModal.css";
import { supabase } from "../../../supabaseClient";

interface StockOrderModalProps {
  stock: any;
  onClose: () => void;
  onExecuteTrade?: (trade: TradeOrder) => void;
}

interface TradeOrder {
  symbol: string;
  orderType: "market" | "limit";
  action: "buy" | "sell";
  quantity: number;
  limitPrice?: number;
  totalValue: number;
}

export default function StockOrderModal({
  stock,
  onClose,
  onExecuteTrade,
}: StockOrderModalProps) {
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState(0);
  const [limitPrice, setLimitPrice] = useState(stock.price);
  const [isProcessing, setIsProcessing] = useState(false);

  const effectivePrice = orderType === "market" ? stock.price : limitPrice;
  const totalValue = quantity * effectivePrice;

  const isValidOrder =
    quantity > 0 &&
    (orderType === "market" || (orderType === "limit" && limitPrice > 0));

  const handleExecute = async () => {
    if (!isValidOrder) return;

    setIsProcessing(true);

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      alert("You must be logged in to place trades");
      setIsProcessing(false);
      return;
    }

    const userId = user.id;
    const profileId = user.id;

    const trade: TradeOrder = {
      symbol: stock.symbol,
      orderType,
      action,
      quantity,
      limitPrice: orderType === "limit" ? limitPrice : undefined,
      totalValue,
    };

    const price = effectivePrice;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("trades")
      .insert([
        {
          profile_id: profileId,
          symbol: stock.symbol,
          side: action,
          quantity: quantity,
          price: price,
          // notional removed - it's auto-calculated by the DB
          order_type: orderType,
          placed_at: now,
          filled_at: now,
          created_by: userId,
        },
      ])
      .select();

    if (error) {
      console.error("Error inserting trade:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      alert(`Failed to execute order: ${error.message || "Unknown error"}`);
      setIsProcessing(false);
      return;
    }

    console.log("Trade inserted successfully:", data);

    if (onExecuteTrade) {
      onExecuteTrade(trade);
    }

    setIsProcessing(false);
    alert(
      `${action.toUpperCase()} order executed: ${quantity} shares of ${stock.symbol}`
    );
    onClose();
  };


  return (
    <div className="stock-order-modal-overlay">
      <div className="stock-order-modal">
        <h2 className="modal-title">Execute Trade</h2>

        <div className="stock-header">
          <span className="stock-symbol">{stock.symbol}</span>
          <span className="stock-name">{stock.name}</span>
        </div>

        <div className="current-price">
          <span className="label">Current Price</span>
          <span className="value">${stock.price.toFixed(2)}</span>
        </div>

        {/* Action Toggle */}
        <div className="section">
          <span className="label">Action</span>
          <div className="action-toggle">
            <button
              className={`toggle-button ${action === "buy" ? "active buy" : ""}`}
              onClick={() => setAction("buy")}
            >
              Buy
            </button>
            <button
              className={`toggle-button ${
                action === "sell" ? "active sell" : ""
              }`}
              onClick={() => setAction("sell")}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Order Type */}
        <div className="section">
          <span className="label">Order Type</span>
          <div className="order-type-toggle">
            <button
              className={`toggle-button ${
                orderType === "market" ? "active" : ""
              }`}
              onClick={() => setOrderType("market")}
            >
              Market
            </button>
            <button
              className={`toggle-button ${
                orderType === "limit" ? "active" : ""
              }`}
              onClick={() => setOrderType("limit")}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div className="section">
          <label className="label" htmlFor="quantity-input">
            Quantity (Shares)
          </label>
          <input
            id="quantity-input"
            type="number"
            min={0}
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(0, parseInt(e.target.value) || 0))
            }
            className="order-input"
            placeholder="Enter number of shares"
          />
        </div>

        {/* Limit Price */}
        {orderType === "limit" && (
          <div className="section">
            <label className="label" htmlFor="limit-price-input">
              Limit Price ($)
            </label>
            <input
              id="limit-price-input"
              type="number"
              min={0}
              step="0.01"
              value={limitPrice}
              onChange={(e) =>
                setLimitPrice(parseFloat(e.target.value) || 0)
              }
              className="order-input"
              placeholder="Enter limit price"
            />
          </div>
        )}

        {/* Summary */}
        <div className="order-summary">
          <div className="summary-row">
            <span className="label">Shares</span>
            <span className="value">{quantity}</span>
          </div>
          <div className="summary-row">
            <span className="label">Price per Share</span>
            <span className="value">${effectivePrice.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span className="label">
              Total {action === "buy" ? "Cost" : "Proceeds"}
            </span>
            <span className="value">${totalValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="modal-actions">
          <button
            className="btn cancel"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className={`btn execute ${action}`}
            onClick={handleExecute}
            disabled={!isValidOrder || isProcessing}
          >
            {isProcessing
              ? "Processing..."
              : `${action === "buy" ? "Buy" : "Sell"} ${stock.symbol}`}
          </button>
        </div>
      </div>
    </div>
  );
}