import { feedbackToClass } from '../lib/gridLogic'

export default function Tile({ letter, feedback }) {
  return (
    <div className={`tile ${feedbackToClass(feedback)}`}>
      {letter?.toUpperCase() ?? ''}
    </div>
  )
}
