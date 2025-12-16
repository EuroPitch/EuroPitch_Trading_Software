# price_data.py
from typing import List, Dict, Any
import yfinance as yf
import pandas as pd


def chunk_list(items: List[str], chunk_size: int) -> List[List[str]]:
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]

def get_quotes_for_universe(
    symbols: List[str],
    provider: str = "yfinance",
    chunk_size: int = 50,
) -> Dict[str, Dict[str, Any]]:
    """
    Fetch latest quotes for many symbols via yfinance and
    return a dict keyed by symbol with quote fields.
    """
    result: Dict[str, Dict[str, Any]] = {}

    for batch in chunk_list(symbols, chunk_size):
        # Download data for the batch
        tickers = yf.Tickers(" ".join(batch))
        
        for symbol in batch:
            try:
                ticker = tickers.tickers[symbol]
                info = ticker.info
                
                # Extract key quote fields (adjust based on what you need)
                result[symbol] = {
                    "symbol": symbol,
                    "price": info.get("currentPrice") or info.get("regularMarketPrice"),
                    "previous_close": info.get("previousClose"),
                    "open": info.get("regularMarketOpen"),
                    "day_high": info.get("dayHigh"),
                    "day_low": info.get("dayLow"),
                    "volume": info.get("volume"),
                    "market_cap": info.get("marketCap"),
                    "52_week_high": info.get("fiftyTwoWeekHigh"),
                    "52_week_low": info.get("fiftyTwoWeekLow"),
                }
            except Exception as e:
                # If a symbol fails, log it but continue
                result[symbol] = {"error": str(e)}

    return result