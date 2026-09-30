package com.trimtime.salon;

import com.trimtime.identity.UserAccount;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "salons")
public class Salon {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false, unique = true)
    private UserAccount owner;
    @Column(nullable = false, length = 160) private String name;
    @Column(length = 2000) private String description;
    @Column(nullable = false, length = 500) private String address;
    @Column(nullable = false, length = 120) private String contact;
    private BigDecimal latitude;
    private BigDecimal longitude;
    @Column(nullable = false, length = 64) private String timezone;
    @Column(name = "slot_increment_minutes") private Integer slotIncrementMinutes;
    @Column(name = "booking_horizon_days", nullable = false) private int bookingHorizonDays = 7;
    @Column(nullable = false) private boolean active = true;
    protected Salon() { }
    public Salon(UserAccount owner, String name, String description, String address, String contact, Double latitude, Double longitude, String timezone) {
        this(owner, name, description, address, contact, latitude, longitude, timezone, null, 7);
    }
    public Salon(UserAccount owner, String name, String description, String address, String contact, Double latitude, Double longitude, String timezone, Integer slotIncrementMinutes, Integer bookingHorizonDays) {
        this.owner=owner; this.name=name; this.description=description; this.address=address; this.contact=contact; this.latitude=latitude == null ? null : BigDecimal.valueOf(latitude); this.longitude=longitude == null ? null : BigDecimal.valueOf(longitude); this.timezone=timezone;
        this.slotIncrementMinutes = slotIncrementMinutes;
        this.bookingHorizonDays = bookingHorizonDays != null ? bookingHorizonDays : 7;
    }
    public Long getId(){return id;} public UserAccount getOwner(){return owner;} public String getName(){return name;} public String getDescription(){return description;} public String getAddress(){return address;} public String getContact(){return contact;} public Double getLatitude(){return latitude == null ? null : latitude.doubleValue();} public Double getLongitude(){return longitude == null ? null : longitude.doubleValue();} public String getTimezone(){return timezone;} public Integer getSlotIncrementMinutes(){return slotIncrementMinutes;} public int getBookingHorizonDays(){return bookingHorizonDays;} public boolean isActive(){return active;}
    public void update(String name,String description,String address,String contact,Double latitude,Double longitude,String timezone){
        update(name, description, address, contact, latitude, longitude, timezone, this.slotIncrementMinutes, this.bookingHorizonDays);
    }
    public void update(String name,String description,String address,String contact,Double latitude,Double longitude,String timezone,Integer slotIncrementMinutes,Integer bookingHorizonDays){
        this.name=name;this.description=description;this.address=address;this.contact=contact;this.latitude=latitude == null ? null : BigDecimal.valueOf(latitude);this.longitude=longitude == null ? null : BigDecimal.valueOf(longitude);this.timezone=timezone;
        this.slotIncrementMinutes = slotIncrementMinutes;
        if (bookingHorizonDays != null) this.bookingHorizonDays = bookingHorizonDays;
    }
}
