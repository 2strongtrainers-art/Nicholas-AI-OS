from dataclasses import dataclass
from typing import Dict, Optional
import math
import pandas as pd
import numpy as np

LIVE_TRADING_ENABLED = False

@dataclass(frozen=True)
class StrategyConfig:
    min_confluences: int = 5
    min_rr: float = 2.3
    rvol_threshold: float = 1.25
    stop_atr_buffer: float = 0.25
    risk_per_trade_pct: float = 0.25
    max_daily_loss_pct: float = 1.0
    max_trades_per_day: int = 3

@dataclass(frozen=True)
class TradeSignal:
    side: str
    entry: float
    stop: float
    target: float
    reward_risk: float
    score: int
    confluences: Dict[str, bool]


def _ema(s, n):
    return s.ewm(span=n, adjust=False).mean()

def _rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1/n, adjust=False, min_periods=n).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1/n, adjust=False, min_periods=n).mean()
    rs = up / dn.replace(0, np.nan)
    return (100 - 100/(1+rs)).fillna(50.0)

def _atr(df, n=14):
    pc = df.close.shift(1)
    tr = pd.concat([(df.high-df.low), (df.high-pc).abs(), (df.low-pc).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1/n, adjust=False, min_periods=n).mean()

def _vwap(df):
    tp = (df.high+df.low+df.close)/3
    return (tp*df.volume).cumsum()/df.volume.cumsum().replace(0,np.nan)

def _trend(df):
    f, s, p = _ema(df.close,20).iloc[-1], _ema(df.close,50).iloc[-1], df.close.iloc[-1]
    return 1 if p>f>s else (-1 if p<f<s else 0)

def _sfp(df, lookback=20):
    prior, cur = df.iloc[-lookback-1:-1], df.iloc[-1]
    bull = cur.low < prior.low.min() and cur.close > prior.low.min()
    bear = cur.high > prior.high.max() and cur.close < prior.high.max()
    return 1 if bull and not bear else (-1 if bear and not bull else 0)

def _structure(df, lookback=8):
    prior, c = df.iloc[-lookback-1:-1], df.close.iloc[-1]
    return 1 if c>prior.high.max() else (-1 if c<prior.low.min() else 0)

def _macd_hist(close):
    line = _ema(close,12)-_ema(close,26)
    return (line-_ema(line,9)).iloc[-1]

def _rvol(df, n=20):
    base=df.volume.rolling(n).mean().iloc[-1]
    return df.volume.iloc[-1]/base if base and math.isfinite(base) else 0.0

def _bollinger_context(df):
    mid=df.close.rolling(20).mean(); sd=df.close.rolling(20).std(ddof=0)
    upper=(mid+2*sd).iloc[-1]; lower=(mid-2*sd).iloc[-1]; px=df.close.iloc[-1]
    return px>=upper*0.997, px<=lower*1.003

class CasperBojanPaperStrategy:
    """Deterministic research strategy. No LLM is allowed to improvise entries."""
    def __init__(self, cfg=None): self.cfg=cfg or StrategyConfig()

    def evaluate(self, df5:pd.DataFrame, df15:pd.DataFrame, df1h:pd.DataFrame)->Optional[TradeSignal]:
        for d in (df5,df15,df1h):
            req={'open','high','low','close','volume'}
            if not req.issubset(d.columns) or len(d)<60: raise ValueError('Need >=60 OHLCV candles on each timeframe')
        t5,t15,t1h=_trend(df5),_trend(df15),_trend(df1h)
        if t15==1 and t1h==1 and t5>=0: side=1
        elif t15==-1 and t1h==-1 and t5<=0: side=-1
        else: return None

        px=float(df5.close.iloc[-1]); sfp=_sfp(df5); mss=_structure(df5); vw=float(_vwap(df5).iloc[-1])
        rvol=_rvol(df5); rsi=float(_rsi(df5.close).iloc[-1]); mh=float(_macd_hist(df5.close)); bb_bear,bb_bull=_bollinger_context(df5)
        if side==1:
            conf={
                'HTF_alignment':True,'liquidity_sweep_SFP':sfp==1,'VWAP_reclaim':px>vw,
                'relative_volume':rvol>=self.cfg.rvol_threshold,'RSI_regime':rsi>=45,
                'MACD_momentum':mh>0,'Bollinger_context':bb_bull,'structure_shift':mss==1,
            }
        else:
            conf={
                'HTF_alignment':True,'liquidity_sweep_SFP':sfp==-1,'VWAP_rejection':px<vw,
                'relative_volume':rvol>=self.cfg.rvol_threshold,'RSI_regime':rsi<=55,
                'MACD_momentum':mh<0,'Bollinger_context':bb_bear,'structure_shift':mss==-1,
            }
        score=sum(conf.values())
        hard_gate=conf['liquidity_sweep_SFP'] and conf.get('VWAP_reclaim',conf.get('VWAP_rejection',False)) and conf['structure_shift']
        if not hard_gate or score<self.cfg.min_confluences: return None
        a=float(_atr(df5).iloc[-1])
        if not math.isfinite(a) or a<=0:return None
        recent=df5.iloc[-21:-1]
        if side==1:
            stop=float(recent.low.min())-self.cfg.stop_atr_buffer*a; risk=px-stop
            if risk<=0:return None
            target=px+self.cfg.min_rr*risk; name='LONG'
        else:
            stop=float(recent.high.max())+self.cfg.stop_atr_buffer*a; risk=stop-px
            if risk<=0:return None
            target=px-self.cfg.min_rr*risk; name='SHORT'
        rr=abs(target-px)/risk
        return TradeSignal(name,px,stop,target,rr,score,conf)

class RiskManager:
    def __init__(self,cfg=None): self.cfg=cfg or StrategyConfig()
    def position_size(self,equity,entry,stop):
        dist=abs(entry-stop)
        if equity<=0 or dist<=0: raise ValueError('Invalid equity/stop')
        return equity*(self.cfg.risk_per_trade_pct/100)/dist
    def can_trade(self,day_start_equity,realized_pnl,trades_today):
        if trades_today>=self.cfg.max_trades_per_day:return False
        loss_pct=max(0,-realized_pnl/day_start_equity*100)
        return loss_pct<self.cfg.max_daily_loss_pct

class PaperExecutor:
    def __init__(self): self.orders=[]
    def submit(self,signal,qty):
        if qty<=0: raise ValueError('qty must be positive')
        order={'side':signal.side,'qty':qty,'entry':signal.entry,'stop':signal.stop,'target':signal.target}
        self.orders.append(order); return order
    def submit_live(self,*args,**kwargs):
        raise RuntimeError('Live trading intentionally disabled; paper/dry-run only.')
