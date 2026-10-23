import TeamScore from '../components/TeamScore.jsx';
import MatchCard from '../components/MatchCard.jsx';
import ActivityTicker from '../components/ActivityTicker.jsx';
import CupOdds from '../components/CupOdds.jsx';

export default function Scoreboard({ state }) {
  const { teams, sessions, totals, tournamentFinal, activity } = state;

  return (
    <div className="space-y-5">
      <TeamScore
        teams={teams}
        totals={totals}
        matches={state.matches}
        tournamentFinal={tournamentFinal}
      />

      <CupOdds state={state} />

      <ActivityTicker activity={activity} teams={teams} />

      {sessions.map((s) => (
        <section key={s.id} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="ribbon">{s.name}</span>
            <span className="flex-1 h-px bg-bunker/60" />
          </div>
          <div className="space-y-2">
            {s.matches.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
