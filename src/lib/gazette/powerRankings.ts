export type RankingResult = { teamId:string;teamName:string;rank:number;score:number;record:string;pointsFor:number;seasonAverage:number;recentAverage:number;winRate:number;pointDifferential:number };
export type RankingInput = { fantasy_team_id:string|null;team_name:string|null;week:number|null;points_for:number|null;point_differential:number|null;result:string|null };

function percentile(values:number[], value:number){if(values.length<2)return 1;const below=values.filter(item=>item<value).length;const equal=values.filter(item=>item===value).length;return (below+(equal-1)/2)/(values.length-1)}
export function buildComputerPoll(rows:RankingInput[],throughWeek:number):RankingResult[]{
  const eligible=rows.filter(row=>row.fantasy_team_id&&row.week&&row.week<=throughWeek);const grouped=new Map<string,RankingInput[]>();
  for(const row of eligible){const id=String(row.fantasy_team_id),list=grouped.get(id)??[];list.push(row);grouped.set(id,list)}
  const metrics=[...grouped.entries()].map(([teamId,games])=>{games.sort((a,b)=>Number(a.week)-Number(b.week));const recent=games.slice(-3);const wins=games.filter(game=>game.result==="W").length,ties=games.filter(game=>game.result==="T").length;const total=(key:"points_for"|"point_differential",source=games)=>source.reduce((sum,game)=>sum+Number(game[key]??0),0);return{teamId,teamName:games.at(-1)?.team_name??"Unknown Team",record:`${wins}-${games.length-wins-ties}${ties?`-${ties}`:""}`,pointsFor:total("points_for"),seasonAverage:total("points_for")/games.length,recentAverage:total("points_for",recent)/recent.length,winRate:(wins+ties*.5)/games.length,pointDifferential:total("point_differential")/games.length}});
  const season=metrics.map(item=>item.seasonAverage),recent=metrics.map(item=>item.recentAverage),wins=metrics.map(item=>item.winRate),diff=metrics.map(item=>item.pointDifferential);
  return metrics.map(item=>({...item,score:100*(.35*percentile(season,item.seasonAverage)+.35*percentile(recent,item.recentAverage)+.2*percentile(wins,item.winRate)+.1*percentile(diff,item.pointDifferential)),rank:0})).sort((a,b)=>b.score-a.score||b.pointsFor-a.pointsFor).map((item,index)=>({...item,rank:index+1}));
}
