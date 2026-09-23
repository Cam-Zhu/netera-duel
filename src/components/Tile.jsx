import { feedbackToClass } from '../lib/gridLogic'

// The letter is wrapped rather than sitting bare in the tile: the ink wash
// that reveals a guess (see .guess-row--reveal in tokens.css) is a positioned
// pseudo-element, which would paint over a bare text node.
export default function Tile({ letter, feedback, index }) {
  return (
    <div className={`tile ${feedbackToClass(feedback)}`} style={index === undefined ? undefined : { '--i': index }}>
      <span className="tile__letter">{letter?.toUpperCase() ?? ''}</span>
    </div>
  )
}
