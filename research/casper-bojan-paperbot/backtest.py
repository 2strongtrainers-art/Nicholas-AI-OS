#!/usr/bin/env python3
"""Vectorized BTC/ETH backtest for the Casper/Bojan-inspired paper bot.
Research only. No authenticated exchange client, broker adapter, or live order path.
"""
from __future__ import annotations
import argparse, csv, json, statistics, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd

LIVE_EXECUTION_ENABLED=False
URL='https://data-api.binance.vision/api/v3/klines'
STEP=300_000
RISK_PCT=.25; DAILY_STOP_PCT=1.; MAX_TRADES_DAY=3; MIN_RR=2.3; MIN_CONF=5; RVOL=1.25


def to_ms(s):
    return int(datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)


def fetch(symbol,start,end):
    cur=start; rows=[]
    while cur<=end:
        q=urllib.parse.urlencode({'symbol':symbol,'interval':'5m','startTime':cur,'endTime':end,'limit':1000})
        req=urllib.request.Request(URL+'?'+q,headers={'User-Agent':'Nicholas-AI-OS-paper-research/2.0'})
        payload=None; err=None
        for a in range(4):
            try:
                with urllib.request.urlopen(req,timeout=20) as r: payload=json.loads(r.read().decode())
                break
            except Exception as e: err=e; time.sleep(.5*(a+1))
        if payload is None: raise RuntimeError(f'{symbol} fetch failed: {err}')
        if not isinstance(payload,list): raise RuntimeError(f'unexpected response: {payload!r}')
        if not payload: break
        rows.extend(payload); nxt=int(payload[-1][0])+STEP
        if nxt<=cur: raise RuntimeError('non-advancing cursor')
        cur=nxt
        if len(payload)<1000: break
    uniq={int(r[0]):r for r in rows if int(r[0])<=end}
    data=[(pd.to_datetime(k,unit='ms',utc=True),float(r[1]),float(r[2]),float(r[3]),float(r[4]),float(r[5])) for k,r in sorted(uniq.items())]
    df=pd.DataFrame(data,columns=['timestamp','open','high','low','close','volume']).set_index('timestamp')
    if len(df)<10000 or not df.index.is_monotonic_increasing or df.index.has_duplicates: raise RuntimeError(f'bad data {symbol}: {len(df)} bars')
    if (df[['open','high','low','close']]<=0).any().any() or (df.volume<0).any(): raise RuntimeError('invalid OHLCV')
    return df


def rsi(s,n=14):
    d=s.diff(); up=d.clip(lower=0).ewm(alpha=1/n,adjust=False,min_periods=n).mean(); dn=(-d.clip(upper=0)).ewm(alpha=1/n,adjust=False,min_periods=n).mean()
    return 100-100/(1+up/dn.replace(0,np.nan))


def atr(df,n=14):
    pc=df.close.shift(1); tr=pd.concat([(df.high-df.low),(df.high-pc).abs(),(df.low-pc).abs()],axis=1).max(axis=1)
    return tr.ewm(alpha=1/n,adjust=False,min_periods=n).mean()


def complete_resample(df,rule,minutes):
    x=df.resample(rule,label='left',closed='left').agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'})
    count=df.close.resample(rule,label='left',closed='left').count(); x=x[count==minutes//5].dropna()
    x.index=x.index+pd.Timedelta(minutes=minutes)  # availability time = close, prevents partial-HTF lookahead
    return x


def htf_trend(df):
    f=df.close.ewm(span=20,adjust=False).mean(); s=df.close.ewm(span=50,adjust=False).mean()
    return pd.Series(np.where((df.close>f)&(f>s),1,np.where((df.close<f)&(f<s),-1,0)),index=df.index)


def features(df):
    out=df.copy(); close_time=out.index+pd.Timedelta(minutes=5)
    h15=complete_resample(df,'15min',15); h1=complete_resample(df,'1h',60)
    t15=htf_trend(h15).reindex(close_time,method='ffill').set_axis(out.index)
    t1=htf_trend(h1).reindex(close_time,method='ffill').set_axis(out.index)
    f1=h1.close.ewm(span=20,adjust=False).mean(); s1=h1.close.ewm(span=50,adjust=False).mean()
    rg=pd.Series(np.where((h1.close>f1)&(f1>s1)&(f1>f1.shift(1)),'bull',np.where((h1.close<f1)&(f1<s1)&(f1<f1.shift(1)),'bear','range')),index=h1.index)
    out['t15']=t15.fillna(0).astype(int); out['t1h']=t1.fillna(0).astype(int); out['regime']=rg.reindex(close_time,method='ffill').set_axis(out.index).fillna('unknown')
    lo20=out.low.shift(1).rolling(20).min(); hi20=out.high.shift(1).rolling(20).max()
    out['sfp']=np.where((out.low<lo20)&(out.close>lo20),1,np.where((out.high>hi20)&(out.close<hi20),-1,0))
    lo8=out.low.shift(1).rolling(8).min(); hi8=out.high.shift(1).rolling(8).max()
    out['mss']=np.where(out.close>hi8,1,np.where(out.close<lo8,-1,0))
    day=out.index.floor('D'); tp=(out.high+out.low+out.close)/3; pv=tp*out.volume
    out['vwap']=pv.groupby(day).cumsum()/out.volume.groupby(day).cumsum().replace(0,np.nan)
    out['rvol']=out.volume/out.volume.shift(1).rolling(20).mean().replace(0,np.nan)
    out['rsi']=rsi(out.close); line=out.close.ewm(span=12,adjust=False).mean()-out.close.ewm(span=26,adjust=False).mean(); out['macdh']=line-line.ewm(span=9,adjust=False).mean()
    mid=out.close.rolling(20).mean(); sd=out.close.rolling(20).std(ddof=0); out['near_upper']=out.close>=(mid+2*sd)*.997; out['near_lower']=out.close<=(mid-2*sd)*1.003
    out['atr']=atr(out); out['stop_long']=lo20-.25*out.atr; out['stop_short']=hi20+.25*out.atr
    return out


def candidates(f,version):
    pending=None; sig=[]
    for i in range(60,len(f)-1):
        r=f.iloc[i]; side=int(r.t15) if int(r.t15)==int(r.t1h) else 0
        if not side: pending=None; continue
        sweep=int(r.sfp); mss=int(r.mss)
        if version=='v2':
            if sweep==side: pending=(side,i+6)
            if pending and (i>pending[1] or pending[0]!=side): pending=None
            active=pending is not None
        else: active=sweep==side
        if not active or mss!=side: continue
        if side==1:
            conf=[True,True,r.close>r.vwap,r.rvol>=RVOL,r.rsi>=45,r.macdh>0,bool(r.near_lower),True]; stop=float(r.stop_long)
        else:
            conf=[True,True,r.close<r.vwap,r.rvol>=RVOL,r.rsi<=55,r.macdh<0,bool(r.near_upper),True]; stop=float(r.stop_short)
        if pd.isna(stop) or sum(bool(x) for x in conf)<MIN_CONF: continue
        if side==1 and not r.close>r.vwap: continue
        if side==-1 and not r.close<r.vwap: continue
        if (side==1 and stop>=r.close) or (side==-1 and stop<=r.close): continue
        sig.append({'i':i,'side':side,'stop':stop,'score':sum(bool(x) for x in conf),'regime':str(r.regime)})
        if version=='v2': pending=None
    return sig


def simulate(symbol,f,sigs,version,fee_bps,slip_bps):
    by_i={s['i']+1:s for s in sigs}; fee=fee_bps/10000; slip=slip_bps/10000; equity=10000.; pos=None; trades=[]; day=None; day_start=equity; dpnl=0.; nday=0
    for i in range(61,len(f)):
        b=f.iloc[i]; ts=f.index[i]; d=ts.date()
        if d!=day: day=d; day_start=equity; dpnl=0.; nday=0
        if pos:
            s=pos['side']; sh=b.low<=pos['stop'] if s==1 else b.high>=pos['stop']; th=b.high>=pos['target'] if s==1 else b.low<=pos['target']
            if sh or th:
                reason='stop' if sh else 'target'  # conservative stop-first if both touched
                raw=pos['stop'] if sh else pos['target']; ex=raw*(1-slip if s==1 else 1+slip); gross=(ex-pos['entry'])*pos['qty']*s; fees=fee*pos['qty']*(pos['entry']+ex); pnl=gross-fees
                equity+=pnl; dpnl+=pnl; trades.append({'symbol':symbol,'version':version,'side':'long' if s==1 else 'short','signal_ts':f.index[pos['sig_i']].isoformat(),'entry_ts':pos['entry_ts'].isoformat(),'exit_ts':ts.isoformat(),'reason':reason,'score':pos['score'],'regime':pos['regime'],'net_r':pnl/pos['riskd'],'pnl_pct':pnl/pos['entry_eq']*100})
                pos=None
        s=by_i.get(i)
        if s and not pos and nday<MAX_TRADES_DAY and max(0,-dpnl/day_start*100)<DAILY_STOP_PCT:
            side=s['side']; entry=float(b.open)*(1+slip if side==1 else 1-slip); stop=s['stop']; dist=entry-stop if side==1 else stop-entry
            if dist>0:
                riskd=equity*RISK_PCT/100; target=entry+side*MIN_RR*dist; pos={'side':side,'entry':entry,'stop':stop,'target':target,'qty':riskd/dist,'riskd':riskd,'entry_eq':equity,'sig_i':s['i'],'entry_ts':ts,'score':s['score'],'regime':s['regime']}; nday+=1
    if pos:  # mark-to-market at fixed window close so open losses/wins are not silently dropped
        b=f.iloc[-1]; side=pos['side']; ex=float(b.close)*(1-slip if side==1 else 1+slip); pnl=(ex-pos['entry'])*pos['qty']*side-fee*pos['qty']*(pos['entry']+ex)
        trades.append({'symbol':symbol,'version':version,'side':'long' if side==1 else 'short','signal_ts':f.index[pos['sig_i']].isoformat(),'entry_ts':pos['entry_ts'].isoformat(),'exit_ts':f.index[-1].isoformat(),'reason':'window_close','score':pos['score'],'regime':pos['regime'],'net_r':pnl/pos['riskd'],'pnl_pct':pnl/pos['entry_eq']*100})
    return trades


def metrics(t):
    # Always replay in chronological order so drawdown is not an artifact of symbol append order.
    t=sorted(t,key=lambda x:x['entry_ts'])
    if not t:return {'trades':0,'win_rate_pct':None,'expectancy_r':None,'profit_factor':None,'net_return_pct':0.,'max_drawdown_pct':0.,'trade_sharpe':None}
    rs=[x['net_r'] for x in t]; w=[x for x in rs if x>0]; l=[x for x in rs if x<0]; eq=peak=1.; dd=0.
    for x in t: eq*=1+x['pnl_pct']/100; peak=max(peak,eq); dd=max(dd,(peak-eq)/peak*100)
    sd=statistics.stdev(rs) if len(rs)>1 else 0.; sharpe=(statistics.mean(rs)/sd*(len(rs)**.5)) if sd>0 else None
    return {'trades':len(t),'win_rate_pct':100*len(w)/len(t),'expectancy_r':statistics.mean(rs),'profit_factor':sum(w)/abs(sum(l)) if l else (999. if w else None),'net_return_pct':100*(eq-1),'max_drawdown_pct':dd,'trade_sharpe':sharpe}


def regime_metrics(t):
    return {r:metrics([x for x in t if x.get('regime')==r]) for r in ('bull','bear','range','unknown')}


def run(start_s,end_s,outdir):
    start,end=to_ms(start_s),to_ms(end_s); split=int(start+.7*(end-start)); cut=pd.to_datetime(split,unit='ms',utc=True); out=Path(outdir); out.mkdir(parents=True,exist_ok=True)
    fs={s:features(fetch(s,start,end)) for s in ('BTCUSDT','ETHUSDT')}; cand={(s,v):candidates(f,v) for s,f in fs.items() for v in ('v1','v2')}; report={'paper_only':True,'live_execution_enabled':False,'data_source':URL,'window':{'start':start_s,'end':end_s,'split':cut.isoformat()},'runs':{}}
    alltr={}
    for v in ('v1','v2'):
        report['runs'][v]={}
        for name,fb,sb in (('low',5,1),('baseline',10,3),('harsh',20,5)):
            report['runs'][v][name]={}; alltr[(v,name)]=[]
            for s,f in fs.items():
                t=simulate(s,f,cand[(s,v)],v,fb,sb); alltr[(v,name)]+=t; o=[x for x in t if pd.Timestamp(x['entry_ts'])>=cut]; report['runs'][v][name][s]={'full':metrics(t),'oos':metrics(o),'oos_by_regime':regime_metrics(o),'candidate_signals':len(cand[(s,v)])}
                if t:
                    with (out/f'trades-{v}-{name}-{s}.csv').open('w',newline='') as h: w=csv.DictWriter(h,fieldnames=t[0].keys()); w.writeheader(); w.writerows(t)
    po=[x for x in alltr[('v2','baseline')] if pd.Timestamp(x['entry_ts'])>=cut]; ho=[x for x in alltr[('v2','harsh')] if pd.Timestamp(x['entry_ts'])>=cut]; pm,hm=metrics(po),metrics(ho)
    # Combined expectancy/PF are trade-sequence diagnostics. Drawdown gate uses the worst true per-symbol OOS simulation, not a synthetic merged portfolio.
    symbol_oos=[report['runs']['v2']['baseline'][s]['oos'] for s in ('BTCUSDT','ETHUSDT')]
    worst_symbol_dd=max(x['max_drawdown_pct'] for x in symbol_oos)
    gates={'oos_trades_ge_30':pm['trades']>=30,'oos_expectancy_gt_0_10R':pm['expectancy_r'] is not None and pm['expectancy_r']>.10,'oos_pf_gt_1_20':pm['profit_factor'] is not None and pm['profit_factor']>1.2,'worst_symbol_oos_dd_lt_10pct':worst_symbol_dd<10,'harsh_oos_expectancy_positive':hm['expectancy_r'] is not None and hm['expectancy_r']>0}
    report['verdict']={'status':'CANDIDATE_FOR_EXTENDED_PAPER' if all(gates.values()) else 'NO_GO_LIVE','gates':gates,'primary_oos':pm,'harsh_oos':hm,'worst_symbol_oos_drawdown_pct':worst_symbol_dd,'primary_oos_by_regime':regime_metrics(po)}; (out/'report.json').write_text(json.dumps(report,indent=2)); print('CASPER_BOJAN_RESULT='+json.dumps(report['verdict'],sort_keys=True))
    for s,d in report['runs']['v2']['baseline'].items(): print('PRIMARY',s,json.dumps(d,sort_keys=True))
    return report


def main():
    p=argparse.ArgumentParser(); p.add_argument('--start',default='2026-02-26T00:00:00Z'); p.add_argument('--end',default='2026-08-24T23:55:00Z'); p.add_argument('--out',default='results/casper-bojan'); a=p.parse_args(); run(a.start,a.end,a.out)

if __name__=='__main__': main()
