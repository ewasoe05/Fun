import { useNavigate } from 'react-router-dom'
import ExerciseSearch from '../components/ExerciseSearch'

export default function ExercisesScreen() {
  const navigate = useNavigate()
  return (
    <>
      <h1>Exercises</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Your library, plus online search of the free wger.de exercise database.
      </p>
      <ExerciseSearch onSelect={(ex) => navigate(`/exercises/${ex.id}`)} />
    </>
  )
}
