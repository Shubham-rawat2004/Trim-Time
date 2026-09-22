package com.trimtime.availability;
import com.trimtime.identity.UserAccount; import jakarta.persistence.*; import java.time.*;
@Entity @Table(name="barber_working_hours") public class WorkingHour {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="barber_user_id",nullable=false) private UserAccount barber;
 @Column(name="week_start_date",nullable=false) private LocalDate weekStartDate; @Column(name="day_of_week",nullable=false) private int dayOfWeek; @Column(name="start_time",nullable=false) private LocalTime startTime; @Column(name="end_time",nullable=false) private LocalTime endTime;
 protected WorkingHour(){} public WorkingHour(UserAccount barber,LocalDate weekStartDate,int dayOfWeek,LocalTime startTime,LocalTime endTime){this.barber=barber;this.weekStartDate=weekStartDate;this.dayOfWeek=dayOfWeek;this.startTime=startTime;this.endTime=endTime;}
 public Long getId(){return id;} public LocalDate getWeekStartDate(){return weekStartDate;} public int getDayOfWeek(){return dayOfWeek;} public LocalTime getStartTime(){return startTime;} public LocalTime getEndTime(){return endTime;}
 public void setTimes(LocalTime startTime,LocalTime endTime){this.startTime=startTime;this.endTime=endTime;}
}
