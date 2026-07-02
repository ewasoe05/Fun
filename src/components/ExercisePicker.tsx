import type { Exercise } from '../types'
import ExerciseSearch from './ExerciseSearch'

interface Props {
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExercisePicker({ onSelect, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <strong>Add exercise</strong>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <ExerciseSearch autoFocus onSelect={onSelect} />
        </div>
      </div>
    </div>
  )
}
