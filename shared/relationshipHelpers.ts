export type RelationshipGoal = { id: string | number; text: string; done: boolean };
export type RelationshipActivity = { id: string | number; date: string; type: string; text: string };
export type RelationshipPerson = { goals?: RelationshipGoal[]; activity?: RelationshipActivity[] };

export function withRelationshipActivity(person: RelationshipPerson, entry: RelationshipActivity) {
  return { ...person, activity: [entry, ...(person.activity || [])] };
}

export function addRelationshipGoal(person: RelationshipPerson, goal: RelationshipGoal, activity: RelationshipActivity) {
  return withRelationshipActivity({ ...person, goals: [...(person.goals || []), goal] }, activity);
}

export function editRelationshipGoal(person: RelationshipPerson, goalId: string | number, text: string, activity: RelationshipActivity) {
  return withRelationshipActivity({ ...person, goals: (person.goals || []).map((goal) => goal.id === goalId ? { ...goal, text } : goal) }, activity);
}

export function toggleRelationshipGoal(person: RelationshipPerson, goalId: string | number, activity: RelationshipActivity) {
  return withRelationshipActivity({ ...person, goals: (person.goals || []).map((goal) => goal.id === goalId ? { ...goal, done: !goal.done } : goal) }, activity);
}

export function deleteRelationshipGoal(person: RelationshipPerson, goalId: string | number, activity: RelationshipActivity) {
  return withRelationshipActivity({ ...person, goals: (person.goals || []).filter((goal) => goal.id !== goalId) }, activity);
}
