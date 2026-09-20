/**
 * Task Management
 * Inspired by Open WebUI's task management system with subtasks, dependencies, and progress tracking
 * Provides comprehensive task lifecycle management with Kanban-style organization
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: number;
  estimatedHours?: number;
  actualHours?: number;
  subtasks: SubTask[];
  dependencies: string[];
  tags: string[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  metadata: TaskMetadata;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled' | 'blocked';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SubTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  completed: boolean;
  completedAt?: number;
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: number;
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
}

export interface TaskMetadata {
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy?: string;
  projectId?: string;
  sprintId?: string;
  version: number;
}

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assignee?: string[];
  tags?: string[];
  dueDateRange?: TimeRange;
  searchQuery?: string;
}

export interface TimeRange {
  start?: number;
  end?: number;
}

export interface TaskStatistics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  overdueTasks: number;
  completedTasks: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  completionRate: number;
}

export interface TaskBoard {
  id: string;
  name: string;
  description: string;
  columns: BoardColumn[];
  tasks: string[];
  metadata: BoardMetadata;
}

export interface BoardColumn {
  id: string;
  name: string;
  status: TaskStatus;
  order: number;
  limit?: number;
}

export interface BoardMetadata {
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  projectId?: string;
}

export interface TaskSprint {
  id: string;
  name: string;
  description: string;
  startDate: number;
  endDate: number;
  status: SprintStatus;
  tasks: string[];
  goal?: string;
  metadata: SprintMetadata;
}

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface SprintMetadata {
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  projectId?: string;
}

class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private boards: Map<string, TaskBoard> = new Map();
  private sprints: Map<string, TaskSprint> = new Map();
  private taskHistory: TaskHistoryEntry[] = [];
  private maxHistorySize: number = 1000;

  /**
   * Create a task
   */
  createTask(task: Omit<Task, 'id' | 'metadata'>): Task {
    const newTask: Task = {
      ...task,
      id: this.generateTaskId(),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system',
        version: 1,
      },
    };

    this.tasks.set(newTask.id, newTask);
    this.addToHistory(newTask.id, 'created', {});

    return newTask;
  }

  /**
   * Update a task
   */
  updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'metadata'>>): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    Object.assign(task, updates);
    task.metadata.updatedAt = Date.now();
    task.metadata.updatedBy = 'system';
    task.metadata.version++;

    this.addToHistory(taskId, 'updated', updates);

    return task;
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.addToHistory(taskId, 'deleted', {});
    return this.tasks.delete(taskId);
  }

  /**
   * Get a task
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Filter tasks
   */
  filterTasks(filter: TaskFilter): Task[] {
    let tasks = this.getAllTasks();

    if (filter.status && filter.status.length > 0) {
      tasks = tasks.filter(t => filter.status!.includes(t.status));
    }

    if (filter.priority && filter.priority.length > 0) {
      tasks = tasks.filter(t => filter.priority!.includes(t.priority));
    }

    if (filter.assignee && filter.assignee.length > 0) {
      tasks = tasks.filter(t => t.assignee && filter.assignee!.includes(t.assignee));
    }

    if (filter.tags && filter.tags.length > 0) {
      tasks = tasks.filter(t => filter.tags!.some(tag => t.tags.includes(tag)));
    }

    if (filter.dueDateRange) {
      tasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        if (filter.dueDateRange!.start && t.dueDate < filter.dueDateRange!.start) return false;
        if (filter.dueDateRange!.end && t.dueDate > filter.dueDateRange!.end) return false;
        return true;
      });
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    return tasks;
  }

  /**
   * Add a subtask
   */
  addSubTask(taskId: string, subtask: Omit<SubTask, 'id'>): SubTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const newSubTask: SubTask = {
      ...subtask,
      id: this.generateSubTaskId(),
    };

    task.subtasks.push(newSubTask);
    task.metadata.updatedAt = Date.now();
    task.metadata.version++;

    this.addToHistory(taskId, 'subtask_added', { subtaskId: newSubTask.id });

    return newSubTask;
  }

  /**
   * Update a subtask
   */
  updateSubTask(taskId: string, subtaskId: string, updates: Partial<SubTask>): SubTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return null;

    Object.assign(subtask, updates);

    if (updates.completed) {
      subtask.completedAt = Date.now();
    }

    task.metadata.updatedAt = Date.now();
    task.metadata.version++;

    this.addToHistory(taskId, 'subtask_updated', { subtaskId, updates });

    return subtask;
  }

  /**
   * Delete a subtask
   */
  deleteSubTask(taskId: string, subtaskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const index = task.subtasks.findIndex(st => st.id === subtaskId);
    if (index === -1) return false;

    task.subtasks.splice(index, 1);
    task.metadata.updatedAt = Date.now();
    task.metadata.version++;

    this.addToHistory(taskId, 'subtask_deleted', { subtaskId });

    return true;
  }

  /**
   * Add a comment
   */
  addComment(taskId: string, comment: Omit<TaskComment, 'id' | 'createdAt'>): TaskComment | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const newComment: TaskComment = {
      ...comment,
      id: this.generateCommentId(),
      createdAt: Date.now(),
    };

    task.comments.push(newComment);
    task.metadata.updatedAt = Date.now();
    task.metadata.version++;

    this.addToHistory(taskId, 'comment_added', { commentId: newComment.id });

    return newComment;
  }

  /**
   * Add an attachment
   */
  addAttachment(taskId: string, attachment: Omit<TaskAttachment, 'id' | 'uploadedAt'>): TaskAttachment | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const newAttachment: TaskAttachment = {
      ...attachment,
      id: this.generateAttachmentId(),
      uploadedAt: Date.now(),
    };

    task.attachments.push(newAttachment);
    task.metadata.updatedAt = Date.now();
    task.metadata.version++;

    this.addToHistory(taskId, 'attachment_added', { attachmentId: newAttachment.id });

    return newAttachment;
  }

  /**
   * Move a task to a different status
   */
  moveTask(taskId: string, newStatus: TaskStatus): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = newStatus;
    task.metadata.updatedAt = Date.now();
    task.metadata.version++;

    this.addToHistory(taskId, 'status_changed', { from: task.status, to: newStatus });

    return task;
  }

  /**
   * Create a board
   */
  createBoard(board: Omit<TaskBoard, 'id' | 'metadata'>): TaskBoard {
    const newBoard: TaskBoard = {
      ...board,
      id: this.generateBoardId(),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system',
      },
    };

    this.boards.set(newBoard.id, newBoard);

    return newBoard;
  }

  /**
   * Get a board
   */
  getBoard(boardId: string): TaskBoard | undefined {
    return this.boards.get(boardId);
  }

  /**
   * Get all boards
   */
  getAllBoards(): TaskBoard[] {
    return Array.from(this.boards.values());
  }

  /**
   * Add task to board
   */
  addTaskToBoard(boardId: string, taskId: string): boolean {
    const board = this.boards.get(boardId);
    const task = this.tasks.get(taskId);

    if (!board || !task) return false;

    if (!board.tasks.includes(taskId)) {
      board.tasks.push(taskId);
      board.metadata.updatedAt = Date.now();
    }

    return true;
  }

  /**
   * Remove task from board
   */
  removeTaskFromBoard(boardId: string, taskId: string): boolean {
    const board = this.boards.get(boardId);
    if (!board) return false;

    const index = board.tasks.indexOf(taskId);
    if (index === -1) return false;

    board.tasks.splice(index, 1);
    board.metadata.updatedAt = Date.now();

    return true;
  }

  /**
   * Create a sprint
   */
  createSprint(sprint: Omit<TaskSprint, 'id' | 'metadata'>): TaskSprint {
    const newSprint: TaskSprint = {
      ...sprint,
      id: this.generateSprintId(),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system',
      },
    };

    this.sprints.set(newSprint.id, newSprint);

    return newSprint;
  }

  /**
   * Get a sprint
   */
  getSprint(sprintId: string): TaskSprint | undefined {
    return this.sprints.get(sprintId);
  }

  /**
   * Get all sprints
   */
  getAllSprints(): TaskSprint[] {
    return Array.from(this.sprints.values());
  }

  /**
   * Add task to sprint
   */
  addTaskToSprint(sprintId: string, taskId: string): boolean {
    const sprint = this.sprints.get(sprintId);
    const task = this.tasks.get(taskId);

    if (!sprint || !task) return false;

    if (!sprint.tasks.includes(taskId)) {
      sprint.tasks.push(taskId);
      sprint.metadata.updatedAt = Date.now();
      task.metadata.sprintId = sprintId;
      task.metadata.updatedAt = Date.now();
    }

    return true;
  }

  /**
   * Get statistics
   */
  getStatistics(): TaskStatistics {
    const tasks = this.getAllTasks();

    const tasksByStatus: Record<TaskStatus, number> = {} as any;
    const tasksByPriority: Record<TaskPriority, number> = {} as any;

    for (const task of tasks) {
      tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
      tasksByPriority[task.priority] = (tasksByPriority[task.priority] || 0) + 1;
    }

    const now = Date.now();
    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'done').length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
    const totalActualHours = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

    const completionRate = tasks.length > 0 ? completedTasks / tasks.length : 0;

    return {
      totalTasks: tasks.length,
      tasksByStatus,
      tasksByPriority,
      overdueTasks,
      completedTasks,
      totalEstimatedHours,
      totalActualHours,
      completionRate,
    };
  }

  /**
   * Get task history
   */
  getTaskHistory(taskId: string, limit?: number): TaskHistoryEntry[] {
    const history = this.taskHistory.filter(h => h.taskId === taskId);
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Set max history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    this.trimHistory();
  }

  // Private methods

  private addToHistory(taskId: string, action: string, data: Record<string, unknown>): void {
    const entry: TaskHistoryEntry = {
      taskId,
      action,
      data,
      timestamp: Date.now(),
    };

    this.taskHistory.push(entry);
    this.trimHistory();
  }

  private trimHistory(): void {
    if (this.taskHistory.length > this.maxHistorySize) {
      this.taskHistory = this.taskHistory.slice(-this.maxHistorySize);
    }
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubTaskId(): string {
    return `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAttachmentId(): string {
    return `attachment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBoardId(): string {
    return `board-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSprintId(): string {
    return `sprint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface TaskHistoryEntry {
  taskId: string;
  action: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Global task manager instance
const taskManager = new TaskManager();

export function createTask(task: Omit<Task, 'id' | 'metadata'>): Task {
  return taskManager.createTask(task);
}

export function updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'metadata'>>): Task | null {
  return taskManager.updateTask(taskId, updates);
}

export function deleteTask(taskId: string): boolean {
  return taskManager.deleteTask(taskId);
}

export function getTask(taskId: string): Task | undefined {
  return taskManager.getTask(taskId);
}

export function getAllTasks(): Task[] {
  return taskManager.getAllTasks();
}

export function filterTasks(filter: TaskFilter): Task[] {
  return taskManager.filterTasks(filter);
}

export function addSubTask(taskId: string, subtask: Omit<SubTask, 'id'>): SubTask | null {
  return taskManager.addSubTask(taskId, subtask);
}

export function updateSubTask(taskId: string, subtaskId: string, updates: Partial<SubTask>): SubTask | null {
  return taskManager.updateSubTask(taskId, subtaskId, updates);
}

export function deleteSubTask(taskId: string, subtaskId: string): boolean {
  return taskManager.deleteSubTask(taskId, subtaskId);
}

export function addComment(taskId: string, comment: Omit<TaskComment, 'id' | 'createdAt'>): TaskComment | null {
  return taskManager.addComment(taskId, comment);
}

export function addAttachment(taskId: string, attachment: Omit<TaskAttachment, 'id' | 'uploadedAt'>): TaskAttachment | null {
  return taskManager.addAttachment(taskId, attachment);
}

export function moveTask(taskId: string, newStatus: TaskStatus): Task | null {
  return taskManager.moveTask(taskId, newStatus);
}

export function createBoard(board: Omit<TaskBoard, 'id' | 'metadata'>): TaskBoard {
  return taskManager.createBoard(board);
}

export function getBoard(boardId: string): TaskBoard | undefined {
  return taskManager.getBoard(boardId);
}

export function getAllBoards(): TaskBoard[] {
  return taskManager.getAllBoards();
}

export function addTaskToBoard(boardId: string, taskId: string): boolean {
  return taskManager.addTaskToBoard(boardId, taskId);
}

export function removeTaskFromBoard(boardId: string, taskId: string): boolean {
  return taskManager.removeTaskFromBoard(boardId, taskId);
}

export function createSprint(sprint: Omit<TaskSprint, 'id' | 'metadata'>): TaskSprint {
  return taskManager.createSprint(sprint);
}

export function getSprint(sprintId: string): TaskSprint | undefined {
  return taskManager.getSprint(sprintId);
}

export function getAllSprints(): TaskSprint[] {
  return taskManager.getAllSprints();
}

export function addTaskToSprint(sprintId: string, taskId: string): boolean {
  return taskManager.addTaskToSprint(sprintId, taskId);
}

export function getStatistics(): TaskStatistics {
  return taskManager.getStatistics();
}

export function getTaskHistory(taskId: string, limit?: number): TaskHistoryEntry[] {
  return taskManager.getTaskHistory(taskId, limit);
}

export function setMaxHistorySize(size: number): void {
  taskManager.setMaxHistorySize(size);
}
