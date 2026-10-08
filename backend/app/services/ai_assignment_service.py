"""
AI Assignment Service for SmartCloud

Manages user tasks/assignments associated with AI-powered operations.

Features:
- Create assignments from files or manual input
- List assignments (with filtering by status, priority, due date)
- Update assignment status and metadata
- Link assignments to files for context
- All operations scoped to authenticated user
"""

from __future__ import annotations

from typing import Optional, Any
from datetime import datetime, timedelta
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY


class AIAssignmentService:
    """
    Manages AI assignments for the authenticated user.
    
    All operations are scoped to the authenticated user - assignments
    can only be created/modified/deleted by their owner.
    """

    # Valid assignment statuses
    VALID_STATUSES = ["not_started", "in_progress", "completed", "cancelled"]
    VALID_PRIORITIES = ["low", "medium", "high", "urgent"]

    def __init__(self, authenticated_user_id: str, supabase_client: Optional[Client] = None):
        """
        Initialize AIAssignmentService with authenticated user context.
        
        Args:
            authenticated_user_id: UUID of the authenticated user (from JWT token)
            supabase_client: Optional Supabase client instance (created if None)
        
        Raises:
            ValueError: If authenticated_user_id is empty
        """
        if not authenticated_user_id or not str(authenticated_user_id).strip():
            raise ValueError("authenticated_user_id cannot be empty")
        
        self.authenticated_user_id = str(authenticated_user_id)
        self._client = supabase_client

    def _get_client(self) -> Client:
        """Get or initialize Supabase client."""
        if self._client is None:
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return self._client

    # ────────────────────────────────────────────────────────────────────────
    # CREATE ASSIGNMENT
    # ────────────────────────────────────────────────────────────────────────

    def create_assignment(
        self,
        title: str,
        description: Optional[str] = None,
        file_id: Optional[str] = None,
        due_date: Optional[str] = None,  # ISO 8601 format
        priority: str = "medium",
        tags: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Create a new assignment for the authenticated user.
        
        Args:
            title: Assignment title/name
            description: Detailed description
            file_id: Optional file UUID to associate with assignment
            due_date: Due date in ISO 8601 format (e.g., "2024-12-25")
            priority: Priority level ("low", "medium", "high", "urgent")
            tags: Optional list of tags for organization
        
        Returns:
            Assignment record if successful, None otherwise
        
        Raises:
            ValueError: If priority is invalid or file_id doesn't belong to user
        """
        if priority not in self.VALID_PRIORITIES:
            raise ValueError(f"Invalid priority: {priority}. Must be one of {self.VALID_PRIORITIES}")

        if not title or not title.strip():
            raise ValueError("Title cannot be empty")

        client = self._get_client()

        try:
            # Prepare assignment data
            assignment_data = {
                "user_id": self.authenticated_user_id,
                "title": title.strip(),
                "description": description or "",
                "file_id": file_id,
                "status": "not_started",
                "priority": priority,
                "tags": tags or [],
                "due_date": due_date,
            }

            result = (
                client.table("ai_assignments")
                .insert(assignment_data)
                .execute()
            )

            if result.data and len(result.data) > 0:
                assignment = result.data[0]
                print(f"[AIAssignment] Created assignment '{title}' for user {self.authenticated_user_id[:8]}...")
                return assignment

            print(f"[AIAssignment] Failed to create assignment - no data returned")
            return None

        except Exception as e:
            print(f"[AIAssignment] Failed to create assignment: {e}")
            return None

    # ────────────────────────────────────────────────────────────────────────
    # GET/LIST ASSIGNMENTS
    # ────────────────────────────────────────────────────────────────────────

    def get_assignment(self, assignment_id: str) -> Optional[dict[str, Any]]:
        """
        Get a single assignment by ID.
        
        Args:
            assignment_id: Assignment UUID
        
        Returns:
            Assignment record if owned by authenticated user, None otherwise
        """
        client = self._get_client()

        try:
            result = (
                client.table("ai_assignments")
                .select("*")
                .eq("id", assignment_id)
                .eq("user_id", self.authenticated_user_id)
                .single()
                .execute()
            )

            if result.data:
                print(f"[AIAssignment] Retrieved assignment {assignment_id[:8]}...")
                return result.data

            print(f"[AIAssignment] Assignment {assignment_id[:8]}... not found or not owned by user")
            return None

        except Exception as e:
            print(f"[AIAssignment] Failed to get assignment: {e}")
            return None

    def list_assignments(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        file_id: Optional[str] = None,
        include_completed: bool = True,
        sort_by: str = "due_date",  # "due_date" or "created_at"
    ) -> list[dict[str, Any]]:
        """
        List assignments for the authenticated user.
        
        Args:
            status: Filter by status (e.g., "in_progress")
            priority: Filter by priority (e.g., "high")
            file_id: Filter by associated file
            include_completed: If False, exclude completed assignments
            sort_by: Sort order ("due_date" or "created_at")
        
        Returns:
            List of assignment records matching filters
        """
        client = self._get_client()

        try:
            query = (
                client.table("ai_assignments")
                .select("*")
                .eq("user_id", self.authenticated_user_id)
            )

            if status:
                if status not in self.VALID_STATUSES:
                    raise ValueError(f"Invalid status: {status}")
                query = query.eq("status", status)

            if priority:
                if priority not in self.VALID_PRIORITIES:
                    raise ValueError(f"Invalid priority: {priority}")
                query = query.eq("priority", priority)

            if file_id:
                query = query.eq("file_id", file_id)

            if not include_completed:
                query = query.neq("status", "completed")

            # Sort
            if sort_by == "due_date":
                query = query.order("due_date", desc=False)
            else:
                query = query.order("created_at", desc=True)

            result = query.execute()
            assignments = result.data if result.data else []

            print(f"[AIAssignment] Listed {len(assignments)} assignments for user")
            return assignments

        except ValueError:
            raise
        except Exception as e:
            print(f"[AIAssignment] Failed to list assignments: {e}")
            return []

    def get_assignments_due_soon(self, days: int = 7) -> list[dict[str, Any]]:
        """
        Get assignments due within the next N days.
        
        Args:
            days: Number of days to look ahead (default: 7)
        
        Returns:
            List of assignments due soon, sorted by due date
        """
        client = self._get_client()

        try:
            # Get all active assignments
            result = (
                client.table("ai_assignments")
                .select("*")
                .eq("user_id", self.authenticated_user_id)
                .neq("status", "completed")
                .order("due_date", desc=False)
                .execute()
            )

            assignments = result.data if result.data else []

            # Filter for due dates in next N days
            now = datetime.utcnow()
            cutoff = now + timedelta(days=days)

            due_soon = []
            for a in assignments:
                due_date_str = a.get("due_date")
                if due_date_str:
                    try:
                        due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                        if now <= due_date <= cutoff:
                            due_soon.append(a)
                    except (ValueError, TypeError):
                        pass

            print(f"[AIAssignment] Found {len(due_soon)} assignments due in next {days} days")
            return due_soon

        except Exception as e:
            print(f"[AIAssignment] Failed to get due assignments: {e}")
            return []

    # ────────────────────────────────────────────────────────────────────────
    # UPDATE ASSIGNMENT
    # ────────────────────────────────────────────────────────────────────────

    def update_assignment_status(
        self,
        assignment_id: str,
        status: str,
    ) -> Optional[dict[str, Any]]:
        """
        Update assignment status.
        
        Args:
            assignment_id: Assignment UUID
            status: New status ("not_started", "in_progress", "completed", "cancelled")
        
        Returns:
            Updated assignment record, None if not found or not owned
        
        Raises:
            ValueError: If status is invalid
        """
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid status: {status}. Must be one of {self.VALID_STATUSES}")

        client = self._get_client()

        try:
            # Verify ownership
            existing = self.get_assignment(assignment_id)
            if not existing:
                raise ValueError("Assignment not found or not owned by user")

            result = (
                client.table("ai_assignments")
                .update({"status": status})
                .eq("id", assignment_id)
                .eq("user_id", self.authenticated_user_id)
                .execute()
            )

            if result.data and len(result.data) > 0:
                print(f"[AIAssignment] Updated assignment {assignment_id[:8]}... status to '{status}'")
                return result.data[0]

            return None

        except ValueError:
            raise
        except Exception as e:
            print(f"[AIAssignment] Failed to update assignment status: {e}")
            return None

    def update_assignment_priority(
        self,
        assignment_id: str,
        priority: str,
    ) -> Optional[dict[str, Any]]:
        """
        Update assignment priority.
        
        Args:
            assignment_id: Assignment UUID
            priority: New priority ("low", "medium", "high", "urgent")
        
        Returns:
            Updated assignment record
        
        Raises:
            ValueError: If priority is invalid
        """
        if priority not in self.VALID_PRIORITIES:
            raise ValueError(f"Invalid priority: {priority}. Must be one of {self.VALID_PRIORITIES}")

        client = self._get_client()

        try:
            existing = self.get_assignment(assignment_id)
            if not existing:
                raise ValueError("Assignment not found or not owned by user")

            result = (
                client.table("ai_assignments")
                .update({"priority": priority})
                .eq("id", assignment_id)
                .eq("user_id", self.authenticated_user_id)
                .execute()
            )

            if result.data and len(result.data) > 0:
                print(f"[AIAssignment] Updated assignment priority to '{priority}'")
                return result.data[0]

            return None

        except ValueError:
            raise
        except Exception as e:
            print(f"[AIAssignment] Failed to update priority: {e}")
            return None

    def update_assignment(
        self,
        assignment_id: str,
        **updates,
    ) -> Optional[dict[str, Any]]:
        """
        Update assignment fields.
        
        Args:
            assignment_id: Assignment UUID
            **updates: Fields to update (title, description, due_date, priority, status, tags)
        
        Returns:
            Updated assignment record
        """
        client = self._get_client()

        try:
            existing = self.get_assignment(assignment_id)
            if not existing:
                raise ValueError("Assignment not found or not owned by user")

            # Validate allowed fields
            allowed_fields = {"title", "description", "due_date", "priority", "status", "tags"}
            update_data = {k: v for k, v in updates.items() if k in allowed_fields}

            if not update_data:
                return existing

            result = (
                client.table("ai_assignments")
                .update(update_data)
                .eq("id", assignment_id)
                .eq("user_id", self.authenticated_user_id)
                .execute()
            )

            if result.data and len(result.data) > 0:
                print(f"[AIAssignment] Updated assignment with {len(update_data)} fields")
                return result.data[0]

            return None

        except ValueError:
            raise
        except Exception as e:
            print(f"[AIAssignment] Failed to update assignment: {e}")
            return None

    # ────────────────────────────────────────────────────────────────────────
    # DELETE ASSIGNMENT
    # ────────────────────────────────────────────────────────────────────────

    def delete_assignment(self, assignment_id: str) -> bool:
        """
        Delete an assignment.
        
        Args:
            assignment_id: Assignment UUID
        
        Returns:
            True if deleted, False otherwise
        """
        client = self._get_client()

        try:
            existing = self.get_assignment(assignment_id)
            if not existing:
                print(f"[AIAssignment] Assignment not found or not owned by user")
                return False

            result = (
                client.table("ai_assignments")
                .delete()
                .eq("id", assignment_id)
                .eq("user_id", self.authenticated_user_id)
                .execute()
            )

            print(f"[AIAssignment] Deleted assignment {assignment_id[:8]}...")
            return True

        except Exception as e:
            print(f"[AIAssignment] Failed to delete assignment: {e}")
            return False

    # ────────────────────────────────────────────────────────────────────────
    # STATISTICS & INSIGHTS
    # ────────────────────────────────────────────────────────────────────────

    def get_assignment_stats(self) -> dict[str, Any]:
        """
        Get statistics about user's assignments.
        
        Returns:
            Dict with:
            - total_assignments
            - status_breakdown (dict of status -> count)
            - priority_breakdown (dict of priority -> count)
            - completed_count
            - overdue_count
        """
        try:
            assignments = self.list_assignments(include_completed=True)

            status_breakdown = {}
            priority_breakdown = {}
            overdue_count = 0
            completed_count = 0

            now = datetime.utcnow()

            for a in assignments:
                # Status
                status = a.get("status", "unknown")
                status_breakdown[status] = status_breakdown.get(status, 0) + 1

                # Priority
                priority = a.get("priority", "unknown")
                priority_breakdown[priority] = priority_breakdown.get(priority, 0) + 1

                # Completed
                if status == "completed":
                    completed_count += 1

                # Overdue
                if status != "completed":
                    due_date_str = a.get("due_date")
                    if due_date_str:
                        try:
                            due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                            if due_date < now:
                                overdue_count += 1
                        except (ValueError, TypeError):
                            pass

            return {
                "total_assignments": len(assignments),
                "completed_count": completed_count,
                "pending_count": len(assignments) - completed_count,
                "overdue_count": overdue_count,
                "status_breakdown": status_breakdown,
                "priority_breakdown": priority_breakdown,
            }

        except Exception as e:
            print(f"[AIAssignment] Failed to get stats: {e}")
            return {
                "total_assignments": 0,
                "completed_count": 0,
                "pending_count": 0,
                "overdue_count": 0,
                "status_breakdown": {},
                "priority_breakdown": {},
            }
