import { HashRouter, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import WorkoutScreen from './screens/WorkoutScreen'
import RoutinesScreen from './screens/RoutinesScreen'
import RoutineEditScreen from './screens/RoutineEditScreen'
import ExercisesScreen from './screens/ExercisesScreen'
import ExerciseDetailScreen from './screens/ExerciseDetailScreen'
import ProgressScreen from './screens/ProgressScreen'
import SettingsScreen from './screens/SettingsScreen'
import FoodScreen from './screens/FoodScreen'
import RecipeDetailScreen from './screens/RecipeDetailScreen'
import CoachScreen from './screens/CoachScreen'

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <main className="screen">
          <Routes>
            <Route path="/" element={<WorkoutScreen />} />
            <Route path="/routines" element={<RoutinesScreen />} />
            <Route path="/routines/:id" element={<RoutineEditScreen />} />
            <Route path="/exercises" element={<ExercisesScreen />} />
            <Route path="/exercises/:id" element={<ExerciseDetailScreen />} />
            <Route path="/progress" element={<ProgressScreen />} />
            <Route path="/food" element={<FoodScreen />} />
            <Route path="/food/recipes/:id" element={<RecipeDetailScreen />} />
            <Route path="/coach" element={<CoachScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  )
}
